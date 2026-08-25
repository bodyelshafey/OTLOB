import { IsIn } from 'class-validator';

export class ChangeRoleDto {
  @IsIn(['USER', 'STORE_OWNER', 'DRIVER', 'ADMIN'])
  role: 'USER' | 'STORE_OWNER' | 'DRIVER' | 'ADMIN';
}
