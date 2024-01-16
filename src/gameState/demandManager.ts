import { ZoneType } from '../zoneManager'

// Class for managing demand
export class DemandManager {
  private residential: number = 0
  private commercial: number = 0
  private industrial: number = 0
  private zones: Record<ZoneType, number>

  constructor() {
    this.zones = {
      residential: 0,
      commercial: 0,
      industrial: 0,
      dezone: 0,
    }
  }

  // Calculate demand based on current zones
  calculateDemand(): void {
    // Reset demands to zero before calculation
    this.residential = 0
    this.commercial = 0
    this.industrial = 0

    // Calculate demands based on realistic ratios
    this.industrial += this.zones.commercial * 0.5
    this.residential += this.zones.commercial * 1.5

    this.industrial += this.zones.residential * 0.3
    this.commercial += this.zones.residential * 0.7

    this.residential += this.zones.industrial * 2
    this.commercial += this.zones.industrial * 0.5

    // Adjust for existing supply and ensure demands don't go negative
    this.residential = Math.max(0, this.residential - this.zones.residential)
    this.commercial = Math.max(0, this.commercial - this.zones.commercial)
    this.industrial = Math.max(0, this.industrial - this.zones.industrial)
  }

  // Update zone counts
  updateZones(newZones: Record<ZoneType, number>): void {
    this.zones = newZones
    this.calculateDemand()
  }

  // Get current demands
  getDemands(): Record<ZoneType, number> {
    return {
      residential: this.residential,
      commercial: this.commercial,
      industrial: this.industrial,
      dezone: 0,
    }
  }
}
