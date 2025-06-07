"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Settings,
  Users,
  Trash2,
  Upload,
  Save,
  Copy,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Seat {
  id: string;
  name: string;
  side: "top" | "bottom" | "left" | "right";
  position: number;
}

interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  seatsPerSide: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  seats: Seat[];
}

interface DraggedSeat {
  tableId: string;
  seatId: string;
  name: string;
}

interface MousePosition {
  x: number;
  y: number;
}

// Agregar esta función helper antes del componente principal para calcular el tamaño dinámico de la mesa
const calculateTableSize = (seatsPerSide: {
  top: number;
  bottom: number;
  left: number;
  right: number;
}) => {
  const minWidth = 120;
  const minHeight = 80;
  const seatSpacing = 40; // Espacio mínimo entre asientos
  const nameSpacing = 80; // Espacio adicional para nombres

  // Calcular anchura basada en asientos arriba/abajo
  const maxHorizontalSeats = Math.max(seatsPerSide.top, seatsPerSide.bottom);
  const calculatedWidth = Math.max(
    minWidth,
    maxHorizontalSeats * seatSpacing + nameSpacing
  );

  // Calcular altura basada en asientos izquierda/derecha
  const maxVerticalSeats = Math.max(seatsPerSide.left, seatsPerSide.right);
  const calculatedHeight = Math.max(
    minHeight,
    maxVerticalSeats * seatSpacing + nameSpacing
  );

  return {
    width: calculatedWidth,
    height: calculatedHeight,
  };
};

export default function SeatingPlanner() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [draggedTable, setDraggedTable] = useState<string | null>(null);
  const [draggedSeat, setDraggedSeat] = useState<DraggedSeat | null>(null);
  const [dragOverSeat, setDragOverSeat] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<MousePosition>({
    x: 0,
    y: 0,
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [canvasHeight, setCanvasHeight] = useState(1000);

  useEffect(() => {
    const maxY = Math.max(...tables.flatMap((table) => table.y + table.height));
    if (maxY > canvasHeight) {
      setCanvasHeight(maxY + 100); // margen de seguridad
    }
  }, [tables, canvasHeight]);

  // Actualizar posición del mouse durante el arrastre
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedSeat && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    if (draggedSeat) {
      document.addEventListener("mousemove", handleMouseMove);
      return () => document.removeEventListener("mousemove", handleMouseMove);
    }
  }, [draggedSeat]);

  const addTable = () => {
    const defaultSeatsPerSide = { top: 2, bottom: 2, left: 1, right: 1 };
    const tableSize = calculateTableSize(defaultSeatsPerSide);

    const newTable: Table = {
      id: `table-${Date.now()}`,
      name: `Table ${tables.length + 1}`,
      x: 100,
      y: 100,
      width: tableSize.width,
      height: tableSize.height,
      seatsPerSide: defaultSeatsPerSide,
      seats: [],
    };

    // Generate seats based on seatsPerSide
    const seats: Seat[] = [];
    Object.entries(newTable.seatsPerSide).forEach(([side, count]) => {
      for (let i = 0; i < count; i++) {
        seats.push({
          id: `${newTable.id}-${side}-${i}`,
          name: "",
          side: side as "top" | "bottom" | "left" | "right",
          position: i,
        });
      }
    });
    newTable.seats = seats;

    setTables([...tables, newTable]);
  };

  const updateTable = (tableId: string, updates: Partial<Table>) => {
    setTables(
      tables.map((table) => {
        if (table.id === tableId) {
          const updatedTable = { ...table, ...updates };

          // If seatsPerSide changed, regenerate seats and recalculate size
          if (updates.seatsPerSide) {
            const tableSize = calculateTableSize(updatedTable.seatsPerSide);
            updatedTable.width = tableSize.width;
            updatedTable.height = tableSize.height;

            const seats: Seat[] = [];
            Object.entries(updatedTable.seatsPerSide).forEach(
              ([side, count]) => {
                for (let i = 0; i < count; i++) {
                  const existingSeat = table.seats.find(
                    (s) => s.side === side && s.position === i
                  );
                  seats.push({
                    id: `${tableId}-${side}-${i}`,
                    name: existingSeat?.name || "",
                    side: side as "top" | "bottom" | "left" | "right",
                    position: i,
                  });
                }
              }
            );
            updatedTable.seats = seats;
          }

          return updatedTable;
        }
        return table;
      })
    );
  };

  const deleteTable = (tableId: string) => {
    setTables(tables.filter((table) => table.id !== tableId));
    setSelectedTable(null);
  };

  const duplicateTable = (originalTable: Table) => {
    // Calcular el siguiente número para el nombre
    const tableNumbers = tables
      .map((t) => {
        const match = t.name.match(/Table (\d+)/);
        return match ? Number.parseInt(match[1]) : 0;
      })
      .filter((n) => n > 0);

    const nextNumber =
      tableNumbers.length > 0
        ? Math.max(...tableNumbers) + 1
        : tables.length + 1;

    const duplicatedTable: Table = {
      id: `table-${Date.now()}`,
      name: `Table ${nextNumber}`,
      x: originalTable.x + 50, // Desplazar ligeramente para evitar superposición
      y: originalTable.y + 50,
      width: originalTable.width,
      height: originalTable.height,
      seatsPerSide: { ...originalTable.seatsPerSide }, // Copiar configuración de asientos
      seats: [],
    };

    // Generar nuevos asientos vacíos con la misma configuración
    const seats: Seat[] = [];
    Object.entries(duplicatedTable.seatsPerSide).forEach(([side, count]) => {
      for (let i = 0; i < count; i++) {
        seats.push({
          id: `${duplicatedTable.id}-${side}-${i}`,
          name: "", // Asientos vacíos
          side: side as "top" | "bottom" | "left" | "right",
          position: i,
        });
      }
    });
    duplicatedTable.seats = seats;

    setTables([...tables, duplicatedTable]);

    toast({
      title: "Mesa duplicada",
      description: `Se ha creado ${duplicatedTable.name} con la misma configuración`,
    });
  };

  const updateSeatName = (tableId: string, seatId: string, name: string) => {
    setTables(
      tables.map((table) => {
        if (table.id === tableId) {
          return {
            ...table,
            seats: table.seats.map((seat) =>
              seat.id === seatId ? { ...seat, name } : seat
            ),
          };
        }
        return table;
      })
    );
  };

  // Funciones para manejar el arrastre de mesas
  const handleTableMouseDown = (_: React.MouseEvent, tableId: string) => {
    // Solo permitir arrastrar mesa si no se está arrastrando un asiento
    if (!draggedSeat) {
      setDraggedTable(tableId);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedTable && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      updateTable(draggedTable, { x: x - 60, y: y - 40 });
    }
  };

  // Funciones para manejar el arrastre de asientos
  const handleSeatMouseDown = (
    e: React.MouseEvent,
    tableId: string,
    seat: Seat
  ) => {
    e.stopPropagation(); // Evitar que se active el arrastre de mesa

    if (seat.name.trim()) {
      setDraggedSeat({
        tableId,
        seatId: seat.id,
        name: seat.name,
      });

      // Establecer posición inicial del mouse
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  const handleSeatMouseEnter = (seatId: string) => {
    if (draggedSeat) {
      setDragOverSeat(seatId);
    }
  };

  const handleSeatMouseLeave = () => {
    setDragOverSeat(null);
  };

  const handleSeatMouseUp = (targetTableId: string, targetSeat: Seat) => {
    if (draggedSeat && draggedSeat.seatId !== targetSeat.id) {
      const sourceName = draggedSeat.name;
      const targetName = targetSeat.name;

      setTables((prevTables) => {
        return prevTables.map((table) => {
          // Solo modificar mesas que tengan el asiento de origen o destino
          if (table.id === targetTableId || table.id === draggedSeat.tableId) {
            return {
              ...table,
              seats: table.seats.map((seat) => {
                if (seat.id === targetSeat.id) {
                  return { ...seat, name: sourceName };
                }
                if (seat.id === draggedSeat.seatId) {
                  return { ...seat, name: targetName };
                }
                return seat;
              }),
            };
          }
          return table;
        });
      });

      // Mostrar notificación apropiada
      if (targetName.trim()) {
        toast({
          title: "Guests swapped",
          description: `${sourceName} and ${targetName} have swapped seats`,
        });
      } else {
        toast({
          title: "Guest moved",
          description: `${sourceName} has been moved to a new seat`,
        });
      }
    }

    setDraggedSeat(null);
    setDragOverSeat(null);
  };

  // También necesitamos manejar el mouseUp global para limpiar el estado si se suelta fuera de un asiento
  const handleGlobalMouseUp = () => {
    if (draggedSeat) {
      setDraggedSeat(null);
      setDragOverSeat(null);
    }
    setDraggedTable(null);
  };

  const getSeatPosition = (table: Table, seat: Seat) => {
    const seatSize = 20;
    const seatOffset = 8; // Distancia de la mesa al asiento

    switch (seat.side) {
      case "top": {
        const topSpacing = table.width / (table.seatsPerSide.top + 1);
        return {
          x: table.x + topSpacing * (seat.position + 1) - seatSize / 2,
          y: table.y - seatSize - seatOffset,
        };
      }
      case "bottom": {
        const bottomSpacing = table.width / (table.seatsPerSide.bottom + 1);
        return {
          x: table.x + bottomSpacing * (seat.position + 1) - seatSize / 2,
          y: table.y + table.height + seatOffset,
        };
      }
      case "left": {
        const leftSpacing = table.height / (table.seatsPerSide.left + 1);
        return {
          x: table.x - seatSize - seatOffset,
          y: table.y + leftSpacing * (seat.position + 1) - seatSize / 2,
        };
      }
      case "right": {
        const rightSpacing = table.height / (table.seatsPerSide.right + 1);
        return {
          x: table.x + table.width + seatOffset,
          y: table.y + rightSpacing * (seat.position + 1) - seatSize / 2,
        };
      }
      default:
        return { x: 0, y: 0 };
    }
  };

  // Nueva función para obtener la posición de las etiquetas con alternancia inteligente
  const getLabelPosition = (table: Table, seat: Seat, index: number) => {
    const position = getSeatPosition(table, seat);

    const isEven = index % 2 === 0;

    switch (seat.side) {
      case "top":
        return {
          x: position.x,
          y: position.y - (isEven ? 15 : 35),
          align: "center" as const,
          transform: "translateX(-50%)",
        };

      case "bottom":
        return {
          x: position.x,
          y: position.y + (isEven ? 30 : 50),
          align: "center" as const,
          transform: "translateX(-50%)",
        };

      case "left":
        return {
          x: position.x - 50,
          y: position.y,
          align: "right" as const,
          transform: "translateY(-50%)",
        };

      case "right":
        return {
          x: position.x + 10,
          y: position.y,
          align: "left" as const,
          transform: "translateY(-50%)",
        };

      default:
        return {
          x: position.x,
          y: position.y,
          align: "center" as const,
          transform: "translate(-50%, -50%)",
        };
    }
  };

  // Funciones para exportar e importar el layout
  const exportLayout = () => {
    try {
      const layoutData = JSON.stringify(tables, null, 2);
      const blob = new Blob([layoutData], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `seating-layout-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: "Layout exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export error",
        description: "Layout could not be exported: " + error,
        variant: "destructive",
      });
    }
  };

  const importLayout = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedTables = JSON.parse(content) as Table[];
        setTables(importedTables);
        toast({
          title: "Import successful",
          description: `${importedTables.length} tables loaded`,
        });
      } catch (error) {
        toast({
          title: "Import error",
          description: "The file has an invalid format. Error: " + error,
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);

    // Resetear el input para permitir cargar el mismo archivo nuevamente
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const totalGuests = tables.reduce(
    (total, table) =>
      total + table.seats.filter((seat) => seat.name.trim() !== "").length,
    0
  );

  const totalSeats = tables.reduce(
    (total, table) => total + table.seats.length,
    0
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r p-4 overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Seating Planner</h1>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-blue-50 p-2 rounded">
              <div className="font-medium">Tables</div>
              <div className="text-lg font-bold text-blue-600">
                {tables.length}
              </div>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <div className="font-medium">Guests</div>
              <div className="text-lg font-bold text-green-600">
                {totalGuests}/{totalSeats}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={addTable}
              className="flex-1 cursor-pointer bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Table
            </Button>
            <Button
              onClick={exportLayout}
              variant="outline"
              className="flex-1 cursor-pointer bg-white text-black hover:bg-zinc-100"
            >
              <Save className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <Button
            onClick={handleImportClick}
            variant="outline"
            className="w-full cursor-pointer bg-white text-black hover:bg-zinc-100"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Layout
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={importLayout}
            accept=".json"
            className="hidden"
          />

          {draggedSeat && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 animate-pulse">
              <div className="text-sm font-medium text-blue-800">
                🎯 Dragging guest
              </div>
              <div className="text-sm text-blue-600 font-semibold">
                {draggedSeat.name}
              </div>
              <div className="text-xs text-blue-500 mt-1">
                Drop on another seat to move
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-medium">Tables</h3>
            {tables.map((table) => (
              <Card key={table.id} className="cursor-pointer hover:bg-gray-50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{table.name}</div>
                      <div className="text-sm text-gray-500">
                        {table.seats.filter((s) => s.name).length} /{" "}
                        {table.seats.length} occupied
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTable(table)}
                            className="hover:bg-zinc-200 cursor-pointer"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-white">
                          <DialogHeader>
                            <DialogTitle>Configure {table.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="tableName">Table name</Label>
                              <Input
                                id="tableName"
                                value={table.name}
                                onChange={(e) =>
                                  updateTable(table.id, {
                                    name: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Seats top</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={table.seatsPerSide.top}
                                  onChange={(e) =>
                                    updateTable(table.id, {
                                      seatsPerSide: {
                                        ...table.seatsPerSide,
                                        top:
                                          Number.parseInt(e.target.value) || 0,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Seats bottom</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={table.seatsPerSide.bottom}
                                  onChange={(e) =>
                                    updateTable(table.id, {
                                      seatsPerSide: {
                                        ...table.seatsPerSide,
                                        bottom:
                                          Number.parseInt(e.target.value) || 0,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Seats left</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={table.seatsPerSide.left}
                                  onChange={(e) =>
                                    updateTable(table.id, {
                                      seatsPerSide: {
                                        ...table.seatsPerSide,
                                        left:
                                          Number.parseInt(e.target.value) || 0,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Seats right</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={table.seatsPerSide.right}
                                  onChange={(e) =>
                                    updateTable(table.id, {
                                      seatsPerSide: {
                                        ...table.seatsPerSide,
                                        right:
                                          Number.parseInt(e.target.value) || 0,
                                      },
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateTable(table)}
                        title="Clone table"
                        className="hover:bg-zinc-200 cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTable(table.id)}
                        className="hover:bg-zinc-200 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-auto min-h-0">
        <div
          ref={canvasRef}
          className="w-full h-full relative bg-white"
          onMouseMove={handleMouseMove}
          onMouseUp={handleGlobalMouseUp}
          style={{
            backgroundImage:
              "radial-gradient(circle, #e5e7eb 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            cursor: draggedSeat ? "grabbing" : "default",
            minHeight: `${canvasHeight}px`,
          }}
        >
          {tables.map((table) => (
            <div key={table.id}>
              {/* Table */}
              <div
                className="absolute bg-amber-100 border-2 border-amber-300 rounded-lg cursor-move flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
                style={{
                  left: table.x,
                  top: table.y,
                  width: table.width,
                  height: table.height,
                }}
                onMouseDown={(e) => handleTableMouseDown(e, table.id)}
              >
                <span className="text-sm font-medium text-amber-800">
                  {table.name}
                </span>
              </div>

              {/* Seats */}
              {table.seats.map((seat) => {
                const position = getSeatPosition(table, seat);
                const isBeingDragged = draggedSeat?.seatId === seat.id;
                const isDropTarget =
                  dragOverSeat === seat.id &&
                  draggedSeat &&
                  draggedSeat.seatId !== seat.id;
                const isValidDropTarget =
                  draggedSeat && draggedSeat.seatId !== seat.id;

                return (
                  <div key={seat.id}>
                    <Dialog>
                      <DialogTrigger asChild>
                        <div
                          className={`absolute w-5 h-5 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                            isBeingDragged
                              ? "opacity-30 scale-75 border-dashed border-gray-400 bg-gray-200"
                              : isDropTarget
                              ? seat.name
                                ? "bg-orange-400 border-orange-600 scale-125 shadow-lg animate-pulse"
                                : "bg-blue-400 border-blue-600 scale-125 shadow-lg animate-pulse"
                              : isValidDropTarget
                              ? seat.name
                                ? "bg-yellow-300 border-yellow-500 hover:scale-110"
                                : "bg-green-300 border-green-500 hover:scale-110"
                              : seat.name
                              ? "bg-green-400 border-green-600 hover:scale-110"
                              : "bg-gray-200 border-gray-400 hover:bg-gray-300 hover:scale-110"
                          } ${
                            seat.name && !isBeingDragged
                              ? "cursor-grab active:cursor-grabbing"
                              : ""
                          }`}
                          style={{
                            left: position.x,
                            top: position.y,
                          }}
                          onMouseDown={(e) =>
                            handleSeatMouseDown(e, table.id, seat)
                          }
                          onMouseEnter={() => handleSeatMouseEnter(seat.id)}
                          onMouseLeave={handleSeatMouseLeave}
                          onMouseUp={() => handleSeatMouseUp(table.id, seat)}
                          onClick={() => setSelectedSeat(seat)}
                        />
                      </DialogTrigger>
                      <DialogContent className="bg-white">
                        <DialogHeader>
                          <DialogTitle>Assign Guest</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="guestName">Guest name</Label>
                            <Input
                              id="guestName"
                              value={seat.name}
                              onChange={(e) =>
                                updateSeatName(
                                  table.id,
                                  seat.id,
                                  e.target.value
                                )
                              }
                              placeholder="Enter the name..."
                            />
                          </div>
                          <div className="text-sm text-gray-500">
                            Table: {table.name} - Position: {seat.side}{" "}
                            {seat.position + 1}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                );
              })}

              {/* Seat labels with alternating positions */}
              {table.seats
                .filter((seat) => seat.name && draggedSeat?.seatId !== seat.id)
                .map((seat, index) => {
                  const labelPos = getLabelPosition(table, seat, index);

                  return (
                    <div
                      key={`label-${seat.id}`}
                      className="absolute text-xs bg-white px-2 py-1 rounded shadow-sm border pointer-events-none font-medium"
                      style={{
                        left: labelPos.x,
                        top: labelPos.y,
                        transform: labelPos.transform,
                        minWidth: "60px",
                        textAlign: labelPos.align,
                      }}
                    >
                      {seat.name}
                    </div>
                  );
                })}
            </div>
          ))}

          {/* Elemento fantasma que sigue el cursor durante el arrastre */}
          {draggedSeat && (
            <div
              className="absolute pointer-events-none z-50 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium transform -translate-x-1/2 -translate-y-1/2 animate-bounce"
              style={{
                left: mousePosition.x,
                top: mousePosition.y,
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-white rounded-full"></div>
                {draggedSeat.name}
              </div>
              <div className="text-xs opacity-75 mt-1">
                {dragOverSeat ? "Dropw to move" : "Find a seat..."}
              </div>
            </div>
          )}

          {tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No tables configured</p>
                <p className="text-sm">Click "Add Table" to start</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {(selectedSeat || selectedTable) && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t shadow p-4 z-50 flex justify-between items-center">
          <div>
            {selectedSeat ? (
              <div>
                <h2 className="font-bold text-lg">🎯 Selected Guest</h2>
                <p>
                  <strong>Name:</strong> {selectedSeat.name || "Unnamed"}
                </p>
                <p>
                  <strong>Side:</strong> {selectedSeat.side}
                </p>
                <p>
                  <strong>Position:</strong> {selectedSeat.position + 1}
                </p>
                <p>
                  <strong>Table:</strong>{" "}
                  {tables.find((t) =>
                    t.seats.some((s) => s.id === selectedSeat.id)
                  )?.name || "-"}
                </p>
              </div>
            ) : selectedTable ? (
              <div>
                <h2 className="font-bold text-lg">🪑 Selected Table</h2>
                <p>
                  <strong>Name:</strong> {selectedTable.name}
                </p>
                <p>
                  <strong>Position:</strong> ({selectedTable.x},{" "}
                  {selectedTable.y})
                </p>
                <p>
                  <strong>Seats:</strong>{" "}
                  {selectedTable.seats.filter((s) => s.name.trim()).length} /{" "}
                  {selectedTable.seats.length}
                </p>
              </div>
            ) : null}
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedSeat(null);
              setSelectedTable(null);
            }}
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
