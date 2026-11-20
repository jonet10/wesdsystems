import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Hotel,
  Bed,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Search,
  User,
  Phone,
  CreditCard,
  LogOut,
  Calendar,
  AlertCircle,
  Wrench,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActiveBranchId } from "@/lib/branch";
import { barRestoService } from "@/modules/restaurant/services/barRestoService";
import type { HotelRoom, HotelBooking, RoomStatus, PaymentMethod } from "@/modules/restaurant/types";
import { toast } from "sonner";

export default function BarHotel() {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { branchId } = useActiveBranchId(profile?.business_id ?? null);
  const effectiveBranchId = branchId || profile?.business_id || "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [selectedRoomForCheckIn, setSelectedRoomForCheckIn] = useState<HotelRoom | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [bookingType, setBookingType] = useState<"NIGHT" | "DAY_PASS">("NIGHT");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ESPECES");

  // New room modal
  const [newRoomModalOpen, setNewRoomModalOpen] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomType, setNewRoomType] = useState("Chambre Standard");
  const [newFloor, setNewFloor] = useState("1er étage");
  const [newPriceNight, setNewPriceNight] = useState(3500);
  const [newPriceHour, setNewPriceHour] = useState(1500);

  const loadHotelData = () => {
    const r = barRestoService.getHotelRooms(effectiveBranchId);
    const b = barRestoService.getBookings(effectiveBranchId);
    setRooms(r);
    setBookings(b);
  };

  useEffect(() => {
    loadHotelData();
  }, [effectiveBranchId]);

  // KPIs
  const stats = useMemo(() => {
    const total = rooms.length;
    const available = rooms.filter((r) => r.status === "AVAILABLE").length;
    const occupied = rooms.filter((r) => r.status === "OCCUPIED").length;
    const cleaning = rooms.filter((r) => r.status === "CLEANING").length;
    const maintenance = rooms.filter((r) => r.status === "MAINTENANCE").length;
    const todayRevenue = bookings
      .filter((b) => {
        const today = new Date().toISOString().split("T")[0];
        return b.created_at?.startsWith(today);
      })
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    return { total, available, occupied, cleaning, maintenance, todayRevenue };
  }, [rooms, bookings]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchStatus = statusFilter === "ALL" || room.status === statusFilter;
      const matchSearch =
        room.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.room_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (room.current_guest_name && room.current_guest_name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [rooms, statusFilter, searchQuery]);

  const handleOpenCheckIn = (room: HotelRoom) => {
    setSelectedRoomForCheckIn(room);
    setGuestName("");
    setGuestPhone("");
    setBookingType("NIGHT");
    setPaymentMethod("ESPECES");
    setCheckInModalOpen(true);
  };

  const handleConfirmCheckIn = () => {
    if (!selectedRoomForCheckIn) return;
    if (!guestName.trim()) {
      return toast.error("Veuillez renseigner le nom du client");
    }

    const price =
      bookingType === "NIGHT"
        ? selectedRoomForCheckIn.price_per_night
        : selectedRoomForCheckIn.price_per_hour || 1500;

    barRestoService.addBooking(effectiveBranchId, {
      room_id: selectedRoomForCheckIn.id,
      room_number: selectedRoomForCheckIn.room_number,
      guest_name: guestName.trim(),
      guest_phone: guestPhone.trim(),
      booking_type: bookingType,
      check_in: new Date().toISOString(),
      total_amount: price,
      paid_amount: price,
      payment_method: paymentMethod,
      payment_status: "PAID",
      status: "CHECKED_IN",
    });

    toast.success(`Check-in réussi pour la Chambre ${selectedRoomForCheckIn.room_number}`);
    setCheckInModalOpen(false);
    loadHotelData();
  };

  const handleCheckOut = (room: HotelRoom) => {
    barRestoService.checkOutRoom(effectiveBranchId, room.id);
    toast.info(`Chambre ${room.room_number} libérée et mise en statut "Nettoyage"`);
    loadHotelData();
  };

  const handleMarkCleaned = (room: HotelRoom) => {
    barRestoService.updateRoomStatus(effectiveBranchId, room.id, "AVAILABLE");
    toast.success(`Chambre ${room.room_number} propre et prête pour location !`);
    loadHotelData();
  };

  const handleCreateRoom = () => {
    if (!newRoomNumber.trim()) return toast.error("Le numéro de chambre est obligatoire");

    const newRoom: HotelRoom = {
      id: `room-${effectiveBranchId}-${newRoomNumber.trim()}`,
      branch_id: effectiveBranchId,
      room_number: newRoomNumber.trim(),
      room_type: newRoomType,
      floor: newFloor,
      price_per_night: Number(newPriceNight) || 3500,
      price_per_hour: Number(newPriceHour) || 1500,
      status: "AVAILABLE",
      amenities: ["Climatisation", "TV Câble", "Wi-Fi Gratuit", "Salle de bain privée"],
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const updated = [...rooms, newRoom];
    barRestoService.saveHotelRooms(effectiveBranchId, updated);
    toast.success(`Chambre ${newRoomNumber} ajoutée avec succès !`);
    setNewRoomModalOpen(false);
    setNewRoomNumber("");
    loadHotelData();
  };

  const getStatusBadge = (status: RoomStatus) => {
    switch (status) {
      case "AVAILABLE":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Disponible</Badge>;
      case "OCCUPIED":
        return <Badge className="bg-rose-500 hover:bg-rose-600">Occupée</Badge>;
      case "CLEANING":
        return <Badge className="bg-amber-500 hover:bg-amber-600">En Nettoyage</Badge>;
      case "MAINTENANCE":
        return <Badge variant="secondary">Maintenance</Badge>;
    }
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Hôtel & Chambres"
      subtitle="Gestion des chambres, séjours, check-in et nuitées (Bar, Resto & Hôtel)"
    >
      <StaggerContainer className="space-y-6">
        {/* KPI Cards */}
        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="border-border/60 shadow-sm bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Total Chambres
                  </p>
                  <p className="text-2xl font-black text-foreground">{stats.total}</p>
                </div>
                <Hotel className="h-8 w-8 text-primary/70" />
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium uppercase tracking-wide">
                    Disponibles
                  </p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {stats.available}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500/70" />
              </CardContent>
            </Card>

            <Card className="border-rose-500/30 bg-rose-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-rose-700 dark:text-rose-400 font-medium uppercase tracking-wide">
                    Occupées
                  </p>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    {stats.occupied}
                  </p>
                </div>
                <User className="h-8 w-8 text-rose-500/70" />
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wide">
                    En Nettoyage
                  </p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {stats.cleaning}
                  </p>
                </div>
                <Sparkles className="h-8 w-8 text-amber-500/70" />
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5 shadow-sm col-span-2 md:col-span-1">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary font-medium uppercase tracking-wide">
                    Revenus Séjours
                  </p>
                  <p className="text-xl font-black text-primary truncate">
                    {format(stats.todayRevenue)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-primary/70" />
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        {/* Action Bar & Filters */}
        <StaggerItem>
          <Card className="border-border/60">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <Button
                  size="sm"
                  variant={statusFilter === "ALL" ? "default" : "outline"}
                  onClick={() => setStatusFilter("ALL")}
                >
                  Toutes ({stats.total})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "AVAILABLE" ? "default" : "outline"}
                  onClick={() => setStatusFilter("AVAILABLE")}
                  className="gap-1"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Disponibles ({stats.available})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "OCCUPIED" ? "default" : "outline"}
                  onClick={() => setStatusFilter("OCCUPIED")}
                  className="gap-1"
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Occupées ({stats.occupied})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "CLEANING" ? "default" : "outline"}
                  onClick={() => setStatusFilter("CLEANING")}
                  className="gap-1"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Nettoyage ({stats.cleaning})
                </Button>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="N° chambre, type, client..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                <Button size="sm" onClick={() => setNewRoomModalOpen(true)} className="gap-1 whitespace-nowrap">
                  <Plus className="h-4 w-4" /> Nouvelle Chambre
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Room Grid */}
        <StaggerItem>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRooms.map((room) => {
              const isAvailable = room.status === "AVAILABLE";
              const isOccupied = room.status === "OCCUPIED";
              const isCleaning = room.status === "CLEANING";

              return (
                <Card
                  key={room.id}
                  className={`border transition-all hover:shadow-md ${
                    isOccupied
                      ? "border-rose-300/60 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10"
                      : isCleaning
                      ? "border-amber-300/60 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10"
                      : "border-border/60 hover:border-emerald-400"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary">
                          {room.room_number}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold">{room.room_type}</CardTitle>
                          <p className="text-xs text-muted-foreground">{room.floor}</p>
                        </div>
                      </div>
                      {getStatusBadge(room.status)}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="flex justify-between items-center text-xs border-y py-2 border-border/50">
                      <div>
                        <span className="text-muted-foreground">Nuitée : </span>
                        <span className="font-bold text-foreground">{format(room.price_per_night)}</span>
                      </div>
                      {room.price_per_hour && (
                        <div>
                          <span className="text-muted-foreground">Passage (3h) : </span>
                          <span className="font-semibold text-foreground">{format(room.price_per_hour)}</span>
                        </div>
                      )}
                    </div>

                    {isOccupied && (
                      <div className="rounded-lg bg-rose-500/10 p-2.5 space-y-1 text-xs border border-rose-500/20">
                        <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                          <User className="h-3.5 w-3.5" />
                          <span>{room.current_guest_name || "Client de passage"}</span>
                        </div>
                        {room.current_guest_phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{room.current_guest_phone}</span>
                          </div>
                        )}
                        {room.check_in_date && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Arrivée: {new Date(room.check_in_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isCleaning && (
                      <div className="rounded-lg bg-amber-500/10 p-2 text-xs flex items-center gap-2 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <Sparkles className="h-4 w-4 shrink-0" />
                        <span>Chambre en cours de ménage et désinfection.</span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="pt-1 flex gap-2">
                      {isAvailable && (
                        <Button
                          size="sm"
                          className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          onClick={() => handleOpenCheckIn(room)}
                        >
                          <Bed className="h-4 w-4" /> Check-in Client
                        </Button>
                      )}

                      {isOccupied && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full gap-1.5 font-bold"
                          onClick={() => handleCheckOut(room)}
                        >
                          <LogOut className="h-4 w-4" /> Check-out (Libérer)
                        </Button>
                      )}

                      {isCleaning && (
                        <Button
                          size="sm"
                          className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          onClick={() => handleMarkCleaned(room)}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Prête / Disponible
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Check-in Modal */}
      <Dialog open={checkInModalOpen} onOpenChange={setCheckInModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hotel className="h-5 w-5 text-primary" />
              Check-in Chambre {selectedRoomForCheckIn?.room_number}
            </DialogTitle>
            <DialogDescription>
              {selectedRoomForCheckIn?.room_type} — {selectedRoomForCheckIn?.floor}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="guest-name">Nom complet du Client *</Label>
              <Input
                id="guest-name"
                placeholder="Ex: Jean Moïse"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="guest-phone">Téléphone / WhatsApp</Label>
              <Input
                id="guest-phone"
                placeholder="Ex: +509 37 00 00 00"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type de Séjour</Label>
                <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-md">
                  <Button
                    type="button"
                    size="sm"
                    variant={bookingType === "NIGHT" ? "default" : "ghost"}
                    className="h-8 text-xs font-semibold"
                    onClick={() => setBookingType("NIGHT")}
                  >
                    Nuitée
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={bookingType === "DAY_PASS" ? "default" : "ghost"}
                    className="h-8 text-xs font-semibold"
                    onClick={() => setBookingType("DAY_PASS")}
                  >
                    Passage (3h)
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Paiement</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ESPECES">Espèces (Cash)</option>
                  <option value="MONCASH">MonCash</option>
                  <option value="CARTE">Carte Bancaire</option>
                  <option value="TRANSFERT">Virement</option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex justify-between items-center">
              <span className="text-sm font-medium">Montant à encaisser :</span>
              <span className="text-xl font-black text-primary">
                {format(
                  bookingType === "NIGHT"
                    ? selectedRoomForCheckIn?.price_per_night || 0
                    : selectedRoomForCheckIn?.price_per_hour || 1500
                )}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCheckInModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmCheckIn} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              Valider Check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Room Modal */}
      <Dialog open={newRoomModalOpen} onOpenChange={setNewRoomModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une Chambre</DialogTitle>
            <DialogDescription>Définissez le numéro, le type et les tarifs de la chambre.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="room-num">Numéro de Chambre *</Label>
                <Input
                  id="room-num"
                  placeholder="Ex: 104 ou VIP-2"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="room-floor">Étage</Label>
                <Input
                  id="room-floor"
                  placeholder="Ex: 1er étage"
                  value={newFloor}
                  onChange={(e) => setNewFloor(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Type de Chambre</Label>
              <select
                value={newRoomType}
                onChange={(e) => setNewRoomType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Chambre Standard">Chambre Standard</option>
                <option value="Chambre Confort Deluxe">Chambre Confort Deluxe</option>
                <option value="Suite VIP Exécutive">Suite VIP Exécutive</option>
                <option value="Chambre Double Famille">Chambre Double Famille</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price-night">Prix Nuitée (HTG)</Label>
                <Input
                  id="price-night"
                  type="number"
                  value={newPriceNight}
                  onChange={(e) => setNewPriceNight(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price-hour">Prix Passage 3h (HTG)</Label>
                <Input
                  id="price-hour"
                  type="number"
                  value={newPriceHour}
                  onChange={(e) => setNewPriceHour(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRoomModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateRoom} className="font-bold">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
