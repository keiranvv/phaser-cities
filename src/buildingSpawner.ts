import * as Phaser from 'phaser'

import { GameGrid } from './gameGrid'
import { ZoneType } from './zoneManager'

export type Spawnable = {
  name: string
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
  private _spawnedBuildings: {
    spawnable: Spawnable
    x: number
    y: number
    facingDirection: 'top' | 'right' | 'bottom' | 'left'
    footprint: { x: number; y: number }[]
  }[] = []

  tilemap: Phaser.Tilemaps.Tilemap
  tileset: Phaser.Tilemaps.Tileset
  layer: Phaser.Tilemaps.TilemapLayer

  constructor(gameGrid: GameGrid) {
    super()
    this._gameGrid = gameGrid

    // this.createTilemap()
  }

  // createTilemap() {
  //   this.tilemap = this._gameGrid.scene.make.tilemap({
  //     tileWidth: 32,
  //     tileHeight: 32,
  //     width: this._gameGrid.getGridWidth(),
  //     height: this._gameGrid.getGridWidth(),
  //   })
  //   this.tileset = this.tilemap.addTilesetImage('spawnables', 'spawnablesAtlas')
  //   this.layer = this.tilemap.createBlankLayer('spawnables', this.tileset)
  // }

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
      cluster.forEach(async (points) => {
        let p = [...points]

        while (p.length > 0) {
          let possibleSpawnCells = this.findSpawnableCells(p)

          const { width, height } = this.getClusterSize(p)

          if (!possibleSpawnCells || possibleSpawnCells.length === 0) {
            break
          }

          const direction = possibleSpawnCells[0].roadSide

          let spawnablePossibilities =
            this.getSpawnableBuildingForZoneTypeAndDimensions(
              zoneType,
              width,
              height,
              direction
            )

          spawnablePossibilities = spawnablePossibilities.filter((s) =>
            this.canSpawnBuilding(
              s,
              possibleSpawnCells[0].x,
              possibleSpawnCells[0].y,
              direction
            )
          )

          if (spawnablePossibilities.length === 0) {
            break
          }

          const spawnable =
            spawnablePossibilities[
              Math.floor(Math.random() * spawnablePossibilities.length)
            ]

          if (!spawnable) {
            break
          }

          const buildingFootprint = this.getSpawnedBuildingFootprint(
            spawnable,
            possibleSpawnCells[0].x,
            possibleSpawnCells[0].y,
            direction
          )

          const b = {
            spawnable,
            x: possibleSpawnCells[0].x,
            y: possibleSpawnCells[0].y,
            facingDirection: direction,
            footprint: buildingFootprint,
          }

          this._spawnedBuildings.push(b)
          this.renderSpawnable(b.spawnable, b.x, b.y, direction)

          // Dezone footprint
          buildingFootprint.forEach((f) => {
            this._zonedCells.delete(`${f.x}_${f.y}`)
          })

          p = p.filter((point) => {
            const [x, y] = point.split('_').map(Number)

            return !buildingFootprint.some((f) => f.x === x && f.y === y)
          })

          // sleep 300ms
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      })
    })
  }

  private canSpawnBuilding(
    spawnable: Spawnable,
    x: number,
    y: number,
    direction: 'top' | 'right' | 'bottom' | 'left'
  ) {
    const footprint = this.getSpawnedBuildingFootprint(
      spawnable,
      x,
      y,
      direction
    )

    return footprint.every((f) => this._zonedCells.has(`${f.x}_${f.y}`))
  }

  private renderSpawnable(
    spawnable: Spawnable,
    x: number,
    y: number,
    direction: 'top' | 'right' | 'bottom' | 'left'
  ) {
    const xOffset = direction === 'right' ? x - spawnable.size.width + 1 : x
    const yOffset = direction === 'bottom' ? y - spawnable.size.height + 1 : y

    this._gameGrid.scene.add
      .sprite(
        xOffset * this._gameGrid.getGridCellSize(),
        yOffset * this._gameGrid.getGridCellSize(),
        'spawnablesAtlas',
        spawnable.name
      )
      .setOrigin(0, 0)
  }

  private getSpawnedBuildingFootprint(
    spawnable: Spawnable,
    x: number,
    y: number,
    facingDirection: 'top' | 'right' | 'bottom' | 'left'
  ) {
    const footprint = []

    for (let ix = 0; ix < spawnable.size.width; ix++) {
      for (let iy = 0; iy < spawnable.size.height; iy++) {
        if (facingDirection === 'top') {
          footprint.push({ x: x + ix, y: y + iy })
          continue
        }

        if (facingDirection === 'right') {
          footprint.push({ x: x - iy, y: y + ix })
          continue
        }

        if (facingDirection === 'bottom') {
          footprint.push({ x: x + ix, y: y - iy })
          continue
        }

        if (facingDirection === 'left') {
          footprint.push({ x: x + iy, y: y + ix })
          continue
        }
      }
    }

    return footprint
  }

  private getSpawnableBuildingForZoneTypeAndDimensions(
    type: ZoneType,
    width: number,
    height: number,
    facingDirection: 'top' | 'right' | 'bottom' | 'left'
  ): Spawnable[] {
    if (!spawnables[type]) {
      return []
    }

    const spawnable = spawnables[type].filter(
      (spawnable) =>
        spawnable.size.width <= width &&
        spawnable.size.height <= height &&
        spawnable.possibleOrientations.indexOf(facingDirection) > -1
    )

    if (spawnable) {
      return spawnable
    }

    return []
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

    points
      .sort((a, b) => {
        const [ax, ay] = a.split('_').map(Number)
        const [bx, by] = b.split('_').map(Number)

        if (ax === bx) {
          return ay - by
        }

        return ax - bx
      })
      .forEach((point) => {
        const [x, y] = point.split('_').map(Number)

        if (
          this._spawnedBuildings.some((b) =>
            b.footprint.some((f) => f.x === x && f.y === y)
          )
        ) {
          return
        }

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
