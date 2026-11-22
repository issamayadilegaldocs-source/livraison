import { Args, Float, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ZoneModel } from './zone.model';
import { ZonesService } from './zones.service';
import { ZoneInput } from './dto/zone.input';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Resolver(() => ZoneModel)
export class ZonesResolver {
  constructor(private readonly zonesService: ZonesService) {}

  // public read — unauthenticated access is intentional for discovery queries
  @Query(() => [ZoneModel], { name: 'zones' })
  zones() {
    return this.zonesService.findAll();
  }

  @Query(() => ZoneModel, { name: 'zoneById', nullable: true })
  zoneById(@Args('id', { type: () => String }) id: string) {
    return this.zonesService.findById(id);
  }

  // authenticated read — riders/clients resolve the zone they're currently
  // inside; gated so zone geometry is not exposed to anonymous callers.
  @Query(() => ZoneModel, { name: 'zoneByPoint', nullable: true })
  @UseGuards(ClerkAuthGuard)
  zoneByPoint(
    @Args('latitude', { type: () => Float }) latitude: number,
    @Args('longitude', { type: () => Float }) longitude: number,
  ) {
    return this.zonesService.findByPoint(longitude, latitude);
  }

  @Mutation(() => ZoneModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createZone(@Args('zone', { type: () => ZoneInput }) zone: ZoneInput) {
    return this.zonesService.create(zone);
  }

  @Mutation(() => ZoneModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  editZone(@Args('zone', { type: () => ZoneInput }) zone: ZoneInput) {
    return this.zonesService.edit(zone);
  }

  @Mutation(() => ZoneModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteZone(@Args('id', { type: () => String }) id: string) {
    return this.zonesService.delete(id);
  }
}
