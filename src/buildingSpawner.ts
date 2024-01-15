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

class Building {
  footprint: { x: number; y: number }[]

  constructor(
    public readonly spawnable: Spawnable,
    public readonly x: number,
    public readonly y: number,
    public readonly facingDirection: 'top' | 'right' | 'bottom' | 'left',
    public sprite?: Phaser.GameObjects.Sprite | null,
  ) {
    this.footprint = []

    for (let ix = 0; ix < spawnable.size.width; ix++) {
      for (let iy = 0; iy < spawnable.size.height; iy++) {
        if (facingDirection === 'top') {
          this.footprint.push({ x: x + ix, y: y + iy })
          continue
        }

        if (facingDirection === 'right') {
          this.footprint.push({ x: x - iy, y: y + ix })
          continue
        }

        if (facingDirection === 'bottom') {
          this.footprint.push({ x: x + ix, y: y - iy })
          continue
        }

        if (facingDirection === 'left') {
          this.footprint.push({ x: x + iy, y: y + ix })
          continue
        }
      }
    }
  }
}

export class BuildingSpawner extends Phaser.Events.EventEmitter {
  private _gameGrid: GameGrid
  private _zonedCells: Map<string, ZoneType> = new Map()
  private _roadCells: RoadCell[] = []
  private _roadCellKeys: string[] = []
  private _spawnedBuildings: Building[] = []

  tilemap: Phaser.Tilemaps.Tilemap
  tileset: Phaser.Tilemaps.Tileset
  layer: Phaser.Tilemaps.TilemapLayer

  constructor(gameGrid: GameGrid) {
    super()
    this._gameGrid = gameGrid
  }

  public setZonedCells(zonedCells: Map<string, ZoneType>) {
    this._zonedCells = zonedCells

    this.removeInvalidSpawnables()
    this.update()
  }

  public setRoadCells(roadCells: RoadCell[]) {
    this._roadCells = roadCells

    this._roadCellKeys = roadCells.map((cell) => `${cell.x}_${cell.y}`)

    this.removeInvalidSpawnables()
    this.update()
  }

  private removeInvalidSpawnables() {
    // Filter out buildings that are no longer valid
    this._spawnedBuildings = this._spawnedBuildings.filter((building) => {
      const isValid = building.footprint.every((fp) =>
        this._zonedCells.has(`${fp.x}_${fp.y}`),
      )

      // If the building is not valid, remove its sprite from the scene
      if (!isValid && building.sprite) {
        building.sprite.destroy()
      }

      return isValid
    })
  }

  private async update() {
    const clusters = this.findContiguousZones(
      this.getZonedCellsWithoutBuildings(),
    )

    if (clusters.size === 0) {
      return
    }

    for (const [zoneType, cluster] of clusters.entries()) {
      for (const points of cluster) {
        let p = [...points]

        while (p.length > 0) {
          let possibleSpawnCells = this.findSpawnableCells(p)

          const { width, height } = this.getClusterSize(p)

          if (!possibleSpawnCells || possibleSpawnCells.length === 0) {
            break
          }

          possibleSpawnCells = possibleSpawnCells
            .map((p) => {
              return {
                ...p,
                roadSides: p.roadSides.filter((s) => {
                  const spawnablePossibilities = this.getSpawnableBuildingForZoneTypeAndDimensions(
                    zoneType,
                    width,
                    height,
                    s,
                  )

                  return spawnablePossibilities.length > 0
                }),
              }
            })
            .filter((p) => p.roadSides.length > 0)

          if (possibleSpawnCells.length === 0) {
            break
          }

          const direction =
            possibleSpawnCells[0].roadSides[
              Math.floor(Math.random() * possibleSpawnCells[0].roadSides.length)
            ]

          let spawnablePossibilities = this.getSpawnableBuildingForZoneTypeAndDimensions(
            zoneType,
            width,
            height,
            direction,
          )

          spawnablePossibilities = spawnablePossibilities.filter((s) =>
            this.canSpawnBuilding(
              s,
              possibleSpawnCells[0].x,
              possibleSpawnCells[0].y,
              direction,
            ),
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

          const b = new Building(
            spawnable,
            possibleSpawnCells[0].x,
            possibleSpawnCells[0].y,
            direction,
          )

          b.sprite = this.renderBuilding(b)

          this._spawnedBuildings.push(b)

          p = p.filter((point) => {
            const [x, y] = point.split('_').map(Number)

            return !b.footprint.some((f) => f.x === x && f.y === y)
          })

          // sleep 300ms
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      }
    }
  }

  private getZonedCellsWithoutBuildings() {
    const result = Array.from(this._zonedCells.entries())
      .filter(
        ([key]) =>
          !this._spawnedBuildings.some((b) =>
            b.footprint.some(
              (fp) =>
                fp.x === Number(key.split('_')[0]) &&
                fp.y === Number(key.split('_')[1]),
            ),
          ),
      )
      .map(([key, value]) => ({ key, value }))

    return new Map(result.map(({ key, value }) => [key, value]))
  }

  private canSpawnBuilding(
    spawnable: Spawnable,
    x: number,
    y: number,
    direction: 'top' | 'right' | 'bottom' | 'left',
  ) {
    const building = new Building(spawnable, x, y, direction)

    return building.footprint.every(
      (f) =>
        this._zonedCells.has(`${f.x}_${f.y}`) &&
        !this._spawnedBuildings.some((b) =>
          b.footprint.some((fp) => fp.x === f.x && fp.y === f.y),
        ),
    )
  }

  private renderBuilding({ facingDirection, x, y, spawnable }: Building) {
    const xOffset =
      facingDirection === 'right' ? x - spawnable.size.width + 1 : x
    const yOffset =
      facingDirection === 'bottom' ? y - spawnable.size.height + 1 : y

    return this._gameGrid.scene.add
      .sprite(
        xOffset * this._gameGrid.getGridCellSize(),
        yOffset * this._gameGrid.getGridCellSize(),
        'spawnablesAtlas',
        spawnable.name,
      )
      .setOrigin(0, 0)
  }

  private getSpawnableBuildingForZoneTypeAndDimensions(
    type: ZoneType,
    width: number,
    height: number,
    facingDirection: 'top' | 'right' | 'bottom' | 'left',
  ): Spawnable[] {
    if (!spawnables[type]) {
      return []
    }

    const spawnable = spawnables[type].filter(
      (spawnable) =>
        spawnable.size.width <= width &&
        spawnable.size.height <= height &&
        spawnable.possibleOrientations.indexOf(facingDirection) > -1,
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
      }),
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
            b.footprint.some((f) => f.x === x && f.y === y),
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
      roadSides: [],
      isNearRoad: false,
    }

    neighbors.forEach(([x, y], ix) => {
      if (this.hasRoadCell(x, y)) {
        result.roadSides.push(directions[ix])
        result.isNearRoad = true
      }
    })
    return result
  }

  private hasRoadCell(x: number, y: number) {
    return this._roadCellKeys.includes(`${x}_${y}`)
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
}
