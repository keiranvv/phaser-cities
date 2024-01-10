import * as Phaser from 'phaser'

import { GameGrid } from './gameGrid'
import { ZoneType } from './zoneManager'

export type Spawnable = {
  size: {
    width: number
    height: number
  }
  type: 'residential' | 'commercial' | 'industrial'
}

import spawnables from './data/spawnables.json'

export class BuildingSpawner {
  private _gameGrid: GameGrid
  private _zonedCells: Map<string, ZoneType> = new Map()
  private _roadCells: Map<string, ZoneType> = new Map()

  constructor(gameGrid: GameGrid) {
    this._gameGrid = gameGrid
  }

  public setZonedCells(zonedCells: Map<string, ZoneType>) {
    // Find all contiguous zones of the same type
    this._zonedCells = zonedCells

    const clusters = this.findContiguousZones(zonedCells)
  }

  private findContiguousZones(
    zoneMap: Map<string, ZoneType>,
  ): Map<ZoneType, Array<Array<string>>> {
    const visited = new Set<string>()
    const clustersByType = new Map<ZoneType, Array<Array<string>>>()

    for (const [key, type] of zoneMap.entries()) {
      if (!visited.has(key)) {
        const cluster = this.exploreZone(key, type, zoneMap, visited)
        if (cluster.length > 0) {
          if (!clustersByType.has(type)) {
            clustersByType.set(type, [])
          }
          clustersByType.get(type)?.push(cluster)
        }
      }
    }

    return clustersByType
  }

  private exploreZone(
    start: string,
    type: ZoneType,
    zoneMap: Map<string, ZoneType>,
    visited: Set<string>,
  ): Array<string> {
    const [x, y] = start.split('_').map(Number)
    const stack: string[] = [start]
    const cluster: string[] = []

    while (stack.length > 0) {
      const current = stack.pop()
      if (current && !visited.has(current)) {
        visited.add(current)
        const [cx, cy] = current.split('_').map(Number)

        if (zoneMap.get(current) === type) {
          cluster.push(current)
          // Check adjacent cells of the same type
          const neighbors = [
            `${cx + 1}_${cy}`,
            `${cx - 1}_${cy}`,
            `${cx}_${cy + 1}`,
            `${cx}_${cy - 1}`,
          ]
          for (const neighbor of neighbors) {
            if (zoneMap.get(neighbor) === type && !visited.has(neighbor)) {
              stack.push(neighbor)
            }
          }
        }
      }
    }

    return cluster
  }

  public spawnBuilding() {
    console.log('spawn building')
  }
}
