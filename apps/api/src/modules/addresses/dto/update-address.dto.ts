import { PartialType } from '@nestjs/swagger';
import { CreateAddressDto } from './create-address.dto';

// A real class (not `Partial<CreateAddressDto>`): TypeScript's Partial<> is
// erased at runtime, so Nest's global ValidationPipe saw the body as a plain
// `Object` — no validation and no `whitelist` stripping, which let a client
// PATCH arbitrary columns (including `userId`) onto an address row.
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
