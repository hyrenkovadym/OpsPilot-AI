import { ApiProperty } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';

export class PublicUserDto {
  @ApiProperty({ example: 'c9e1f9fc-7d5a-4b5f-b209-00e43f8fb6f7' })
  id!: string;

  @ApiProperty({ example: 'jane.doe@company.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  fullName!: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role!: Role;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(user: User): PublicUserDto {
    const dto = new PublicUserDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.fullName = user.fullName;
    dto.role = user.role;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
