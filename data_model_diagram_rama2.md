# Diagrama Entidad-Relación `_rama2`: Módulo de Manufactura y Operaciones

Compañero visual de [`data_model_rama2.md`](./data_model_rama2.md). Todas las entidades, atributos y cardinalidades de este diagrama derivan de ese documento.

## Diagrama Entidad-Relación

```mermaid
erDiagram
    Entity ||--o{ Product : "extiende (productType, uom, ...)"
    Entity ||--o{ WorkOrder : "dueña (entity_id)"

    UnitOfMeasure ||--o{ Product : "unidad base (uom)"
    UnitOfMeasure ||--o{ UoMConversion : "fromUom"
    UnitOfMeasure ||--o{ UoMConversion : "toUom"

    Product ||--o{ Bom : "product_id (terminado)"
    Bom ||--|{ BomLine : "bom_id (cascada)"
    Product ||--o{ BomLine : "componentProduct_id"

    Product ||--o{ WorkOrder : "product_id (a fabricar)"
    WorkOrder ||--o{ InventoryMovement : "workOrderId (opcional)"
    Product ||--o{ InventoryMovement : "product_id (journal)"
    Product ||--|| StockBalance : "proyección 1:1"
```

## Máquina de Estados — Orden de Fabricación

```mermaid
stateDiagram-v2
    [*] --> borrador
    borrador --> cancelada : cancelar
    borrador --> liberada : liberar (exige bomVersion_id)
    liberada --> en curso : iniciar
    liberada --> cancelada : cancelar
    en curso --> recibida : recibir (genera receipt y consumos)
    recibida --> cerrada : cerrar (bloquea cambios)
    cerrada --> [*]
    cancelada --> [*]
```

## Máquina de Estados — Lista de Materiales

```mermaid
stateDiagram-v2
    [*] --> borrador
    borrador --> activa : activar
    activa --> obsoleta : obsoletar
    obsoleta --> [*]
```

## Flujo de Inventario (journal → saldo)

```mermaid
flowchart LR
    subgraph Journal append-only
        M1[Movement receipt] --> M2[Movement consumption]
        M2 --> M3[Movement adjustment]
    end
    Journal -->|Σ qtySigned × factor| SB[(StockBalance onHand)]
    WO[WorkOrder recibida] -->|backflush: receipt + consumption| Journal
    MR[Orden liberada] -->|fija bomVersion_id| WO
```

Cómo leerlo:

- **erDiagram**: relaciones y cascadas (borrar el padre elimina lo marcado con *cascada*; el historial de movimientos nunca se borra).
- **stateDiagram**: transiciones legales; cualquier otra vía se rechaza con un motivo.
- **flowchart**: invariante `saldo = Σ movimientos` y quién genera cada movimiento.
