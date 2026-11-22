import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { roles } from '@semh/contracts';
import { change, member, object, text, uuid, uuidList } from '../../../shared/http/input.js';
import { AdminService } from '../application/admin.service.js';
import { AccessGuard, Roles, type SessionRequest } from './access.guard.js';

@Controller('admin/accounts')
@UseGuards(AccessGuard)
@Roles('ADM')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.list();
  }

  @Post()
  create(@Req() request: SessionRequest, @Body() value: unknown) {
    const body = object(value);
    if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 256) {
      throw new BadRequestException('Mật khẩu khởi tạo phải dài từ 12 đến 256 ký tự.');
    }
    return this.admin.create(request.sessionToken, {
      username: text(body.username, 'tên đăng nhập', 50).toLowerCase(),
      displayName: text(body.displayName, 'tên hiển thị', 100), password: body.password,
    }, change(body));
  }

  @Patch(':id')
  update(@Req() request: SessionRequest, @Param('id') id: string, @Body() value: unknown) {
    const body = object(value);
    const patch = {
      displayName: body.displayName === undefined ? undefined : text(body.displayName, 'tên hiển thị', 100),
      status: body.status === undefined ? undefined : member(body.status, ['ACTIVE', 'LOCKED'], 'trạng thái'),
    };
    if (!patch.displayName && !patch.status) throw new BadRequestException('Chọn nội dung cập nhật.');
    return this.admin.update(request.sessionToken, uuid(id), patch, change(body, !!patch.status, true));
  }

  @Post(':id/roles')
  assign(@Req() request: SessionRequest, @Param('id') id: string, @Body() value: unknown) {
    const body = object(value);
    const role = member(body.role, roles, 'vai trò');
    if (typeof body.grant !== 'boolean') throw new BadRequestException('Chọn cấp hoặc thu hồi quyền.');
    const allHubs = role === 'OPR' && body.grant && body.allHubs === true;
    const hubIds = role === 'OPR' && body.grant && !allHubs ? uuidList(body.hubIds ?? [], 'Hub') : [];
    if (role === 'OPR' && body.grant && !allHubs && !hubIds.length) throw new BadRequestException('Chọn phạm vi vận hành.');
    return this.admin.assign(request.sessionToken, uuid(id), { role, grant: body.grant, allHubs, hubIds }, change(body, true, true));
  }
}
