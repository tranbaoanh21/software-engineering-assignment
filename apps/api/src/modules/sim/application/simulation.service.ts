import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { ChangeInput, ScenarioView, SessionView, SimulationParameters, SimulationResult, SimulationRunView } from '@semh/contracts';
import type { Prisma, SimulationRun, SimulationScenario } from '../../../generated/prisma/client.js';
import { AuditService } from '../../../shared/audit/audit.service.js';
import { withChange } from '../../../shared/database/change-receipt.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { assertVersion } from '../../../shared/http/input.js';
import { AccessService } from '../../gen/application/access.service.js';
import { assertOperatorHubs, canOperateAt } from '../../gen/application/operator-scope.js';
import { NetworkReader } from '../../hub/application/network-reader.port.js';
import { analyzeSimulation, campusDemand, executeSimulation, modelVersion, type Snapshot } from '../domain/simulation-engine.js';
import { PrismaSimulationStore } from '../infrastructure/prisma-simulation.store.js';

export type ScenarioInput = Omit<ScenarioView, 'id' | 'version'>;
type PinnedInput = {
  name: string; parameters: SimulationParameters; profile: ReturnType<typeof campusDemand>; profileVersion: string;
};

function json(data: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}

function scenarioView(row: SimulationScenario): ScenarioView {
  return { id: row.id, name: row.name, objective: row.objective, hubIds: row.hubIds,
    parameters: row.parameters as unknown as SimulationParameters, version: row.version };
}

function runView(row: SimulationRun, details = false): SimulationRunView {
  const input = row.inputs as unknown as PinnedInput;
  return {
    id: row.id, scenarioId: row.scenarioId, scenarioVersion: row.scenarioVersion, name: input.name, hubIds: row.hubIds,
    status: row.status, progress: row.progress, analysisReady: row.analysisReady, modelVersion: row.modelVersion,
    baseTime: row.baseTime.toISOString(), capturedAt: row.capturedAt.toISOString(), error: row.error,
    result: details && row.status === 'COMPLETED' ? row.results as unknown as SimulationResult : null,
  };
}

@Injectable()
export class SimulationService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SimulationService.name);
  private readonly tasks = new Set<Promise<void>>();

  constructor(
    private readonly store: PrismaSimulationStore,
    private readonly network: NetworkReader,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    return this.store.failInterruptedRuns();
  }

  async onModuleDestroy() {
    await Promise.allSettled(this.tasks);
  }

  overview(actor: SessionView) {
    return this.store.read(async tx => {
      const scope = actor.operatorHubIds === null ? undefined : actor.operatorHubIds ?? [];
      const hubs = await this.network.read(tx, scope, false);
      const scenarios = (await this.store.scenarios(tx)).filter(row => row.hubIds.every(id => canOperateAt(actor, id)));
      const runs = (await this.store.runs(tx, actor.operatorHubIds)).filter(row => row.hubIds.every(id => canOperateAt(actor, id)));
      return { hubs: hubs.map(({ id, name, resources }) => ({ id, name, resources: resources
        .filter(item => item.kind !== 'HUB').map(({ id: resourceId, code }) => ({ id: resourceId, code })) })), scenarios: scenarios.map(scenarioView), runs: runs.map(row => runView(row)) };
    });
  }

  save(token: string, input: ScenarioInput, change: ChangeInput, id?: string) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['OPR'], tx);
      assertOperatorHubs(actor, ...input.hubIds);
      if (id) {
        const old = await this.store.scenario(tx, id);
        if (!old) throw new NotFoundException('Không tìm thấy kịch bản.');
        assertOperatorHubs(actor, ...old.hubIds);
      }
      return withChange(tx, actor.accountId, 'SCENARIO_SAVED', change, { id, input }, async () => {
        const found = await this.network.read(tx, input.hubIds, false);
        if (found.length !== input.hubIds.length) throw new ConflictException('Phạm vi chứa Hub không tồn tại.');
        const allowed = new Set(found.flatMap(hub => hub.resources.filter(item => item.kind !== 'HUB').map(item => item.id)));
        if (input.parameters.pausedResourceIds?.some(id => !allowed.has(id))) {
          throw new ConflictException('Tài nguyên tạm ngừng nằm ngoài phạm vi kịch bản.');
        }
        const data = { authorId: actor.accountId, ...input, parameters: json(input.parameters) };
        if (id) assertVersion((await this.store.scenario(tx, id))!.version, change.version);
        const row = id ? await this.store.update(tx, id, data) : await this.store.create(tx, data);
        await this.logChange(tx, actor.accountId, 'SCENARIO_SAVED', 'scenario', row.id, change, { version: row.version });
        return scenarioView(row);
      });
    });
  }

  async start(token: string, scenarioId: string, sourceRunId: string | null, change: ChangeInput) {
    let started: SimulationRun | undefined;
    const response = await this.store.write(async tx => {
      started = undefined;
      const actor = await this.access.verifyAccess(token, ['OPR'], tx);
      const row = await this.store.scenario(tx, scenarioId);
      if (!row) throw new NotFoundException('Không tìm thấy kịch bản.');
      assertOperatorHubs(actor, ...row.hubIds);
      return withChange(tx, actor.accountId, 'SIMULATION_STARTED', change, { scenarioId, sourceRunId }, async () => {
        assertVersion(row.version, change.version);
        const now = new Date();
        const previous = sourceRunId ? await this.accessRun(tx, actor, sourceRunId) : null;
        if (previous && (previous.status !== 'COMPLETED' || !row.hubIds.every(id => previous.hubIds.includes(id)))) {
          throw new ConflictException('Snapshot đã lưu không đủ dữ liệu cho phạm vi đã chọn.');
        }
        const source = previous?.snapshot as unknown as Snapshot | undefined;
        const snapshot = source ? {
          hubs: source.hubs.filter(hub => row.hubIds.includes(hub.id)),
          releases: source.releases.filter(release => row.hubIds.includes(release.hubId)),
        } : await this.store.capture(tx, row.hubIds, now);
        if (snapshot.hubs.length !== row.hubIds.length) throw new ConflictException('Không chụp được trạng thái đủ Hub.');
        const parameters = row.parameters as unknown as SimulationParameters;
        const snapshotResources = new Set(snapshot.hubs.flatMap(hub => hub.resources.map(item => item.id)));
        if (parameters.pausedResourceIds?.some(id => !snapshotResources.has(id))) {
          throw new ConflictException('Snapshot không có đầy đủ tài nguyên đã chọn.');
        }
        const inputs = { name: row.name, parameters, profile: campusDemand([...row.hubIds].sort(), parameters),
          profileVersion: 'campus-demand-v1' } satisfies PinnedInput;
        const run = await this.store.createRun(tx, {
          authorId: actor.accountId, requestId: change.requestId, scenarioId, scenarioVersion: row.version, hubIds: row.hubIds,
          inputs: json(inputs), snapshot: json(snapshot), baseTime: previous?.baseTime ?? now, sourceRunId, modelVersion,
        });
        await this.logChange(tx, actor.accountId, 'SIMULATION_STARTED', 'simulation-run', run.id, change, { scenarioId, modelVersion });
        started = run;
        return runView(run);
      });
    });
    if (started) {
      const task = this.processRun(started).catch(error => this.log.error('Could not finish simulation run', error));
      this.tasks.add(task);
      void task.finally(() => this.tasks.delete(task));
    }
    return response;
  }

  result(actor: SessionView, id: string) {
    return this.store.read(async tx => {
      const row = await this.accessRun(tx, actor, id);
      const input = row.inputs as unknown as PinnedInput;
      return { ...runView(row, true), parameters: input.parameters, profileVersion: input.profileVersion, sourceRunId: row.sourceRunId };
    });
  }

  prepare(actor: SessionView, id: string, recommendationId: string) {
    return this.store.read(async tx => {
      const row = await this.accessRun(tx, actor, id);
      if (row.status !== 'COMPLETED' || !row.analysisReady) throw new ConflictException('Phân tích chưa sẵn sàng.');
      const result = row.results as unknown as SimulationResult;
      const rec = result.recommendations.find(item => item.id === recommendationId && item.kind === 'TRANSFER');
      if (!rec?.sourceHubId) throw new NotFoundException('Không tìm thấy đề xuất điều chuyển.');
      const current = await this.network.read(tx, [rec.sourceHubId, rec.hubId]);
      const source = current.find(hub => hub.id === rec.sourceHubId);
      const target = current.find(hub => hub.id === rec.hubId);
      if (!source || !target) throw new ConflictException('Hub nguồn hoặc đích đã ngừng phục vụ.');
      const spaces = Math.max(0, target.capacity - target.vehicleCount - target.heldArrivals);
      const vehicleIds = source.resources
        .filter(item => item.kind === 'VEHICLE' && item.status === 'AVAILABLE' && item.serviceStatus === 'ACTIVE' &&
          item.observedAt && (item.batteryPercent ?? 0) >= 30)
        .slice(0, Math.min(rec.count, spaces)).map(item => item.id);
      if (!vehicleIds.length) throw new ConflictException('Không còn xe hoặc sức chứa đáp ứng đề xuất ở thời điểm hiện tại.');
      return { sourceHubId: source.id, targetHubId: target.id, vehicleIds, reason: rec.evidence, recommendationId };
    });
  }

  private async accessRun(tx: Transaction, actor: SessionView, id: string) {
    const row = await this.store.run(tx, id);
    if (!row) throw new NotFoundException('Không tìm thấy lần chạy.');
    assertOperatorHubs(actor, ...row.hubIds);
    return row;
  }

  private async processRun(row: SimulationRun) {
    try {
      await this.store.updateRun(row.id, { progress: 15 });
      const snapshot = row.snapshot as unknown as Snapshot;
      const input = row.inputs as unknown as PinnedInput;
      const result = executeSimulation(snapshot, input.parameters, input.profile);
      await this.store.updateRun(row.id, { progress: 100, status: 'COMPLETED', results: json(result) });
      try {
        result.recommendations = analyzeSimulation(snapshot, result, input.parameters.closedHubId, randomUUID);
        await this.store.updateRun(row.id, { analysisReady: true, results: json(result) });
      } catch (error) {
        this.log.error('Simulation analysis failed', error);
        await this.store.updateRun(row.id, { error: 'Đã có kết quả, nhưng chưa phân tích được đề xuất.' });
      }
    } catch (error) {
      this.log.error('Simulation run failed', error);
      await this.store.updateRun(row.id, { status: 'FAILED', error: 'Không tính được kết quả lần chạy.' });
    }
  }

  private logChange(
    tx: Transaction, actorId: string, action: string, targetType: string, targetId: string, change: ChangeInput,
    details: Prisma.InputJsonObject,
  ) {
    return this.audit.append(tx, {
      actorId, action, targetType, targetId, requestId: change.requestId, occurredAt: new Date(), details,
    });
  }
}
