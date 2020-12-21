import * as common from "@nestjs/common";
import * as graphql from "@nestjs/graphql";
import * as nestAccessControl from "nest-access-control";
// @ts-ignore
import * as basicAuthGuard from "../auth/basicAuth.guard";
// @ts-ignore
import * as abacUtil from "../auth/abac.util";
// @ts-ignore
import { isRecordNotFoundError } from "../prisma.util";
// @ts-ignore
import * as errors from "../errors";

declare interface CREATE_INPUT {}
declare interface WHERE_INPUT {}
declare interface WHERE_UNIQUE_INPUT {}
declare interface UPDATE_INPUT {}

declare interface CREATE_ARGS {
  data: CREATE_INPUT;
}
declare interface UPDATE_ARGS {
  where: WHERE_INPUT;
  data: UPDATE_INPUT;
}
declare interface DELETE_ARGS {
  where: WHERE_UNIQUE_INPUT;
}
declare interface FIND_MANY_ARGS {
  where: WHERE_INPUT;
}
declare interface FIND_ONE_ARGS {
  where: WHERE_UNIQUE_INPUT;
}

declare class ENTITY {}

declare interface SERVICE {
  create(args: { data: CREATE_INPUT }): Promise<ENTITY>;
  findMany(args: { where: WHERE_INPUT }): Promise<ENTITY[]>;
  findOne(args: { where: WHERE_UNIQUE_INPUT }): Promise<ENTITY | null>;
  update(args: {
    where: WHERE_UNIQUE_INPUT;
    data: UPDATE_INPUT;
  }): Promise<ENTITY>;
  delete(args: { where: WHERE_UNIQUE_INPUT }): Promise<ENTITY>;
}

declare const ENTITY_NAME: string;
declare const ENTITY_PLURAL_NAME: string;
declare const ENTITY_SINGULAR_NAME: string;
declare const CREATE_MUTATION_NAME: string;
declare const UPDATE_MUTATION_NAME: string;
declare const DELETE_MUTATION_NAME: string;

@graphql.Resolver(() => ENTITY)
@common.UseGuards(basicAuthGuard.BasicAuthGuard, nestAccessControl.ACGuard)
export class RESOLVER {
  constructor(
    private readonly service: SERVICE,
    @nestAccessControl.InjectRolesBuilder()
    private readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {}

  @graphql.Query(() => [ENTITY])
  @nestAccessControl.UseRoles({
    resource: ENTITY_NAME,
    action: "read",
    possession: "any",
  })
  async [ENTITY_PLURAL_NAME](
    @graphql.Args() args: FIND_MANY_ARGS,
    @nestAccessControl.UserRoles() userRoles: string[]
  ): Promise<ENTITY[]> {
    const permission = this.rolesBuilder.permission({
      role: userRoles,
      action: "read",
      possession: "any",
      resource: ENTITY_NAME,
    });
    const results = await this.service.findMany(args);
    return results.map((result) => permission.filter(result));
  }

  @graphql.Query(() => ENTITY, { nullable: true })
  @nestAccessControl.UseRoles({
    resource: ENTITY_NAME,
    action: "read",
    possession: "own",
  })
  async [ENTITY_SINGULAR_NAME](
    @graphql.Args() args: FIND_ONE_ARGS,
    @nestAccessControl.UserRoles() userRoles: string[]
  ): Promise<ENTITY | null> {
    const permission = this.rolesBuilder.permission({
      role: userRoles,
      action: "read",
      possession: "own",
      resource: ENTITY_NAME,
    });
    const result = await this.service.findOne(args);
    if (result === null) {
      return null;
    }
    return permission.filter(result);
  }

  @graphql.Mutation(() => ENTITY)
  @nestAccessControl.UseRoles({
    resource: ENTITY_NAME,
    action: "create",
    possession: "any",
  })
  async [CREATE_MUTATION_NAME](
    @graphql.Args() args: CREATE_ARGS,
    @nestAccessControl.UserRoles() userRoles: string[]
  ): Promise<ENTITY> {
    const permission = this.rolesBuilder.permission({
      role: userRoles,
      action: "create",
      possession: "any",
      resource: ENTITY_NAME,
    });
    const invalidAttributes = abacUtil.getInvalidAttributes(
      permission,
      args.data
    );
    if (invalidAttributes.length) {
      const properties = invalidAttributes
        .map((attribute: string) => JSON.stringify(attribute))
        .join(", ");
      const roles = userRoles
        .map((role: string) => JSON.stringify(role))
        .join(",");
      throw new errors.ForbiddenException(
        `providing the properties: ${properties} on ${ENTITY_NAME} creation is forbidden for roles: ${roles}`
      );
    }
    // @ts-ignore
    return await this.service.create(args);
  }

  @graphql.Mutation(() => ENTITY)
  @nestAccessControl.UseRoles({
    resource: ENTITY_NAME,
    action: "update",
    possession: "any",
  })
  async [UPDATE_MUTATION_NAME](
    @graphql.Args() args: UPDATE_ARGS,
    @nestAccessControl.UserRoles() userRoles: string[]
  ): Promise<ENTITY | null> {
    const permission = this.rolesBuilder.permission({
      role: userRoles,
      action: "update",
      possession: "any",
      resource: ENTITY_NAME,
    });
    const invalidAttributes = abacUtil.getInvalidAttributes(
      permission,
      args.data
    );
    if (invalidAttributes.length) {
      const properties = invalidAttributes
        .map((attribute: string) => JSON.stringify(attribute))
        .join(", ");
      const roles = userRoles
        .map((role: string) => JSON.stringify(role))
        .join(",");
      throw new errors.ForbiddenException(
        `providing the properties: ${properties} on ${ENTITY_NAME} update is forbidden for roles: ${roles}`
      );
    }
    try {
      // @ts-ignore
      return await this.service.update(args);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(args.where)}`
        );
      }
      throw error;
    }
  }

  @graphql.Mutation(() => ENTITY)
  @nestAccessControl.UseRoles({
    resource: ENTITY_NAME,
    action: "delete",
    possession: "any",
  })
  async [DELETE_MUTATION_NAME](
    @graphql.Args() args: DELETE_ARGS
  ): Promise<ENTITY | null> {
    try {
      // @ts-ignore
      return await this.service.delete(args);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(args.where)}`
        );
      }
      throw error;
    }
  }
}
