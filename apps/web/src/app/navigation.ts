export const operationViews = [
  { key: 'overview', label: 'Tổng quan', title: 'Tổng quan mạng lưới', icon: 'pin' },
  { key: 'incidents', label: 'Sự cố', title: 'Danh sách sự cố', icon: 'alert' },
  { key: 'plans', label: 'Điều chuyển', title: 'Kế hoạch điều chuyển', icon: 'transfer' },
  { key: 'resources', label: 'Tài nguyên', title: 'Tài nguyên tại Hub', icon: 'pin' },
] as const;

export const adminViews = [
  { key: 'accounts', label: 'Tài khoản', title: 'Quản lý tài khoản', icon: 'pin' },
  { key: 'permissions', label: 'Phân quyền', title: 'Vai trò và phạm vi truy cập', icon: 'bolt' },
  { key: 'catalog', label: 'Danh mục ban đầu', title: 'Danh mục tài nguyên ban đầu', icon: 'alert' },
] as const;
