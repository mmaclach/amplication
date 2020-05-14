import {
  Injectable,
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import { Organization, User } from '../../models';
import { PasswordService } from './../account/password.service';
import { PrismaService } from '../../services/prisma.service';
import { UserService } from '../user/user.service';
import {
  FindManyOrganizationArgs,
  FindOneArgs,
  UpdateOneOrganizationArgs,
  InviteUserArgs,
  CreateOneOrganizationArgs
} from '../../dto/args';
import { Role } from '../../enums/Role';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly userService: UserService
  ) {}

  async Organization(args: FindOneArgs): Promise<Organization | null> {
    return this.prisma.organization.findOne(args);
  }

  async Organizations(args: FindManyOrganizationArgs): Promise<Organization[]> {
    return this.prisma.organization.findMany(args);
  }

  async deleteOrganization(args: FindOneArgs): Promise<Organization | null> {
    return this.prisma.organization.delete(args);
  }

  async updateOrganization(
    args: UpdateOneOrganizationArgs
  ): Promise<Organization | null> {
    return this.prisma.organization.update(args);
  }

  ///This function should be called when a new account register for the service, or when an existing account creates a new organization
  ///The account is automatically linked with the new organization with a new user record in role "Organizaiton Admin"
  async createOrganization(accountId: string, args: CreateOneOrganizationArgs) {
    //Create organization
    //Create a new user record and link it to the account
    //Assign the user an "ORGANIZATION_ADMIN" role
    const org = await this.prisma.organization.create({
      ...args,
      data: {
        ...args.data,
        users: {
          create: {
            account: { connect: { id: accountId } },
            userRoles: {
              create: {
                role: Role.ORGANIZATION_ADMIN
              }
            }
          }
        }
      },
      include: {
        users: {
          include: {
            userRoles: true
          }
        }
      }
    });

    return org;
  }

  async inviteUser(
    currentUser: User,
    args: InviteUserArgs
  ): Promise<User | null> {
    //const organizationId = 'FA90A838-EBFE-4162-9746-22CC9FE49B62'; //todo: get organization Id from user's context

    const account = await this.prisma.account.findOne({
      where: { email: args.data.email }
    });

    if (account) {
      const userExist = await this.prisma.user.findMany({
        where: {
          account: { id: account.id },
          organization: { id: currentUser.organization.id }
        }
      });

      if (userExist && userExist.length) {
        throw new ConflictException(
          `User with email ${args.data.email} already exist in the organization.`
        );
      }
    }
    if (!account) {
      const hashedPassword = await this.passwordService.hashPassword(
        'generateRandomPassword'
      ); //todo: Generate Random Passowrd

      //Create a new account
      const account = await this.prisma.account.create({
        data: {
          firstName: '',
          lastName: '',
          email: args.data.email,
          password: hashedPassword
        }
      });
    }

    //Create a new user record and link it to the account
    const user = await this.prisma.user.create({
      data: {
        organization: { connect: { id: currentUser.organization.id } },
        account: { connect: { id: account.id } }
      }
    });

    return user;
  }
}