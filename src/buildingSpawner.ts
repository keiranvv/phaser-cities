import * as Phaser from 'phaser'

import { GameGrid } from './gameGrid'
import { ZoneType } from './zoneManager'

export type Spawnable = {
  size: {
    width: number
    height: number
  }
  tilemap: {
    index: number
  }
  type: 'residential' | 'commercial' | 'industrial'
}

import spawnables from './data/spawnables.json'
import { RoadCell } from './roadManager'
import { calculateCoordinateDimensions } from './util/grid'

export class BuildingSpawner extends Phaser.Events.EventEmitter {
  private _gameGrid: GameGrid
  private _zonedCells: Map<string, ZoneType> = new Map()
  private _roadCells: RoadCell[] = []
  private _roadCellKeys: string[] = []
  private _spawnedBuildings: { spawnable: Spawnable; x: number; y: number }[] =
    []

  tilemap: Phaser.Tilemaps.Tilemap
  tileset: Phaser.Tilemaps.Tileset
  layer: Phaser.Tilemaps.TilemapLayer

  constructor(gameGrid: GameGrid) {
    super()
    this._gameGrid = gameGrid

    this.createTilemap()
  }

  createTilemap() {
    this.tilemap = this._gameGrid.scene.make.tilemap({
      tileWidth: 32,
      tileHeight: 32,
      width: this._gameGrid.getGridWidth(),
      height: this._gameGrid.getGridWidth(),
    })
    this.tileset = this.tilemap.addTilesetImage('spawnables', null)
    this.layer = this.tilemap.createBlankLayer(
      'spawnablesLayer',
      this.tileset,
      0,
      0
    )
  }

  public setZonedCells(zonedCells: Map<string, ZoneType>) {
    // Find all contiguous zones of the same type
    this._zonedCells = zonedCells

    this.update()
  }

  public setRoadCells(roadCells: RoadCell[]) {
    // Find all contiguous zones of the same type
    this._roadCells = roadCells

    this._roadCellKeys = roadCells.map((cell) => `${cell.x}_${cell.y}`)

    this.update()
  }

  private update() {
    const clusters = this.findContiguousZones(this._zonedCells)

    if (clusters.size === 0) {
      return
    }

    clusters.forEach((cluster, zoneType) => {
      cluster.forEach((points) => {
        let p = [...points]

        while (p.length > 0) {
          let possibleSpawnCells = this.findSpawnableCells(p)

          const { width, height } = this.getClusterSize(p)

          if (!possibleSpawnCells || possibleSpawnCells.length === 0) {
            break
          }

          const spawnable = this.getSpawnableBuildingForZoneTypeAndDimensions(
            zoneType,
            width,
            height,
            possibleSpawnCells[0].roadSide
          )

          if (!spawnable) {
            break
          }

          const b = {
            spawnable,
            x: possibleSpawnCells[0].x,
            y: possibleSpawnCells[0].y,
          }

          this._spawnedBuildings.push(b)
          this.tilemap.putTileAt(b.spawnable.tilemap.index, b.x, b.y)

          p = p.filter((point) => {
            const [x, y] = point.split('_').map(Number)

            return (
              x < b.x ||
              x > b.x + b.spawnable.size.width - 1 ||
              y < b.y ||
              y > b.y + b.spawnable.size.height - 1
            )
          })
        }
      })
    })
  }

  private getSpawnableBuildingForZoneTypeAndDimensions(
    type: ZoneType,
    width: number,
    height: number,
    facingDirection: 'top' | 'right' | 'bottom' | 'left'
  ): Spawnable | null {
    if (!spawnables[type]) {
      return null
    }

    console.log(facingDirection)

    const spawnable = spawnables[type].find(
      (spawnable) =>
        spawnable.size.width <= width &&
        spawnable.size.height <= height &&
        spawnable.possibleOrientations.indexOf(facingDirection) > -1
    )

    if (spawnable) {
      return spawnable
    }

    return null
  }

  private getClusterSize(points: string[]) {
    return calculateCoordinateDimensions(
      points.map((point) => {
        const [x, y] = point.split('_').map(Number)
        return { x, y }
      })
    )
  }

  private findSpawnableCells(points: string[]) {
    if (this._zonedCells.size === 0) {
      return
    }

    if (this._roadCells.length === 0) {
      return
    }

    if (points.length === 0) {
      return
    }

    const result = []

    points.forEach((point) => {
      const [x, y] = point.split('_').map(Number)
      const spawnable = this.pointIsNearRoad(x, y)
      if (spawnable.isNearRoad) {
        result.push({ ...spawnable, x, y })
      }
    })

    return result
  }

  private pointIsNearRoad(x: number, y: number) {
    const neighbors = [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ]

    const directions = ['top', 'right', 'bottom', 'left']

    let result = {
      roadSide: null,
      isNearRoad: false,
    }

    neighbors.forEach(([x, y], ix) => {
      if (this.hasRoadCell(x, y)) {
        //TODO: randomly choose between the current roadSide and directions[ix]
        if (result.roadSide) {
          result.roadSide =
            Math.random() > 0.5 ? directions[ix] : result.roadSide
        } else {
          result.roadSide = directions[ix]
        }
        result.isNearRoad = true
      }
    })
    return result
  }

  private hasRoadCell(x: number, y: number) {
    return this._roadCellKeys.includes(`${x}_${y}`)
  }

  private findContiguousZones(
    zoneMap: Map<string, ZoneType>
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
    visited: Set<string>
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
