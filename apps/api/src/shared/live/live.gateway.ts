import { Inject, Injectable, type BeforeApplicationShutdown } from '@nestjs/common';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { liveTopics, type LiveTopic, type SessionView } from '@semh/contracts';
import { WebSocket, WebSocketServer } from 'ws';
import { SETTINGS, type Settings } from '../../config/settings.js';
import { AccessService } from '../../modules/gen/application/access.service.js';
import { canOperateAt } from '../../modules/gen/application/operator-scope.js';
import { sessionCookieName } from '../../modules/gen/domain/session.js';
import { committedChanges, type LiveChange } from './committed-changes.js';

const notification = JSON.stringify({ type: 'changed' });
const topicNames: ReadonlySet<string> = new Set(liveTopics);
const hubPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

interface Subscription {
  topics: ReadonlySet<LiveTopic>;
  hubId: string | null;
  token: string;
  alive: boolean;
}

function permits(session: SessionView, topic: LiveTopic) {
  if (topic === 'incident') return session.roles.includes('OPR');
  return session.roles.includes('STU') || (topic === 'charging' && session.roles.includes('OPR'));
}

@Injectable()
export class LiveGateway implements BeforeApplicationShutdown {
  private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  private readonly subscriptions = new Map<WebSocket, Subscription>();
  private server?: Server;
  private heartbeat?: NodeJS.Timeout;

  constructor(
    private readonly access: AccessService,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}

  attach(server: Server) {
    this.server = server;
    server.on('upgrade', this.upgrade);
    committedChanges.on('change', this.broadcast);
    this.heartbeat = setInterval(() => {
      for (const [socket, subscription] of this.subscriptions) {
        if (!subscription.alive) socket.terminate();
        else if (socket.readyState === WebSocket.OPEN) {
          subscription.alive = false;
          socket.ping();
        }
      }
    }, 25_000).unref();
  }

  beforeApplicationShutdown() {
    clearInterval(this.heartbeat);
    committedChanges.off('change', this.broadcast);
    this.server?.off('upgrade', this.upgrade);
    this.server = undefined;
    for (const socket of this.subscriptions.keys()) socket.terminate();
    this.sockets.close();
  }

  private readonly upgrade = (request: IncomingMessage, stream: Duplex, head: Buffer) => {
    stream.on('error', () => stream.destroy());
    void this.accept(request, stream, head).catch(() => stream.destroy());
  };

  private async accept(request: IncomingMessage, stream: Duplex, head: Buffer) {
    const url = new URL(request.url ?? '/', this.settings.origin);
    if (url.pathname !== '/api/live') {
      stream.destroy();
      return;
    }
    const reject = (status: string) => stream.end('HTTP/1.1 ' + status + '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    if (request.headers.origin !== this.settings.origin) {
      reject('403 Forbidden');
      return;
    }
    const names = url.searchParams.get('topics')?.split(',') ?? [];
    const hub = url.searchParams.get('hub');
    if (!names.length || names.length > liveTopics.length || !names.every(name => topicNames.has(name)) ||
      (hub !== null && !hubPattern.test(hub))) {
      reject('400 Bad Request');
      return;
    }
    const cookiePrefix = sessionCookieName + '=';
    const token = request.headers.cookie?.split(';').map(value => value.trim())
      .find(value => value.startsWith(cookiePrefix))?.slice(cookiePrefix.length);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      reject('401 Unauthorized');
      return;
    }
    const session = await this.readSession(token);
    if (!session) {
      reject('401 Unauthorized');
      return;
    }
    const topics = new Set(names as LiveTopic[]);
    if (![...topics].every(topic => permits(session, topic))) {
      reject('403 Forbidden');
      return;
    }
    if (!this.server || stream.destroyed || !stream.writable) return;
    const subscription: Subscription = { topics, hubId: hub?.toLowerCase() ?? null, token, alive: true };
    this.sockets.handleUpgrade(request, stream, head, socket => {
      this.subscriptions.set(socket, subscription);
      socket.on('pong', () => { subscription.alive = true; });
      socket.on('message', () => socket.close(1008));
      socket.on('error', () => socket.terminate());
      socket.once('close', () => this.subscriptions.delete(socket));
    });
  }

  private readSession(token: string) {
    return this.access.verifyAccess(token, [], undefined, { touch: false }).catch(() => undefined);
  }

  private readonly broadcast = (changes: readonly LiveChange[]) => {
    const sessions = new Map<string, ReturnType<LiveGateway['readSession']>>();
    for (const [socket, subscription] of this.subscriptions) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      const relevant = changes.filter(change => subscription.topics.has(change.topic) &&
        (subscription.hubId === null || change.hubId === null || change.hubId === subscription.hubId));
      if (!relevant.length) continue;
      const session = sessions.get(subscription.token) ?? this.readSession(subscription.token);
      sessions.set(subscription.token, session);
      void session.then(actor => {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (!actor || ![...subscription.topics].every(topic => permits(actor, topic))) {
          socket.close(1008);
        } else if (relevant.some(change => actor.roles.includes('STU') && change.topic !== 'incident' ||
          canOperateAt(actor, change.hubId))) {
          if (socket.bufferedAmount < 8192) socket.send(notification, error => {
            if (error) socket.terminate();
          });
          else socket.terminate();
        }
      });
    }
  };
}
