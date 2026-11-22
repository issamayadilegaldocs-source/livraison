import { registerEnumType } from '@nestjs/graphql';

/** Actor roles served by the single role-aware schema. */
export enum Role {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  VENDOR = 'VENDOR',
  STORE = 'STORE',
  RIDER = 'RIDER',
}

registerEnumType(Role, { name: 'Role' });

/** Shape of the signed JWT payload and `request.user`. */
export interface JwtUser {
  userId: string;
  role: Role;
}
