import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UsersService } from './users.service';
import { UpdateUserDto, UserResponseDto, PublicUserResponseDto } from './dto';
import {
  USERS_CONTROLLER_ROUTE,
  USERS_ME_ROUTE,
  CURRENT_USER_ID_PARAM,
} from '../../shared/constants';

@Controller(USERS_CONTROLLER_ROUTE)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // TODO: Add @UseGuards(JwtAuthGuard) and get user from request
  @Get(USERS_ME_ROUTE)
  async getCurrentUser(): Promise<UserResponseDto> {
    // TODO: Get user ID from JWT token in request
    const userId = CURRENT_USER_ID_PARAM; // Placeholder
    const user = await this.usersService.findByIdOrThrow(userId);
    return plainToInstance(UserResponseDto, user);
  }

  @Patch(USERS_ME_ROUTE)
  async updateCurrentUser(
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // TODO: Get user ID from JWT token in request
    const userId = CURRENT_USER_ID_PARAM; // Placeholder
    const user = await this.usersService.update(userId, updateUserDto);
    return plainToInstance(UserResponseDto, user);
  }

  @Delete(USERS_ME_ROUTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCurrentUser(): Promise<void> {
    // TODO: Get user ID from JWT token in request
    const userId = CURRENT_USER_ID_PARAM; // Placeholder
    await this.usersService.softDelete(userId);
  }

  @Get(':id')
  async getPublicProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicUserResponseDto> {
    const user = await this.usersService.findByIdOrThrow(id);
    return plainToInstance(PublicUserResponseDto, user);
  }
}
