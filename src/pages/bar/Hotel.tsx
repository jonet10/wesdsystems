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
  Timer,
  Moon,
  SunMedium,
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
  const [now, setNow] = useState(Date.now());

  // Check-in modal state
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [selectedRoomForCheckIn, setSelectedRoomForCheckIn] = useState<HotelRoom | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [bookingType, setBookingType] = useState<"MOMENT" | "NIGHT">("MOMENT");
  const [momentHours, setMomentHours] = useState<number>(2); // 2 hours default
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ESPECES");

  // New room modal
  const [newRoomModalOpen, setNewRoomModalOpen] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomType, setNewRoomType] = useState("Chambre Standard");
  const [newFloor, setNewFloor] = useState("1er étage");
  const [newPriceNight, setNewPriceNight] = useState(3500);
  const [newPriceMoment, setNewPriceMoment] = useState(1500);
  const [newExtraHourPrice, setNewExtraHourPrice] = useState(500);

  // Auto-refresh timer every 30 seconds for live countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

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
    const momentsActive = rooms.filter((r) => r.status === "OCCUPIED" && r.booking_type === "MOMENT").length;
    const nightsActive = rooms.filter((r) => r.status === "OCCUPIED" && r.booking_type === "NIGHT").length;
    const cleaning = rooms.filter((r) => r.status === "CLEANING").length;
    const todayRevenue = bookings
      .filter((b) => {
        const today = new Date().toISOString().split("T")[0];
        return b.created_at?.startsWith(today);
      })
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    return { total, available, occupied, momentsActive, nightsActive, cleaning, todayRevenue };
  }, [rooms, bookings]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "MOMENT"
          ? room.status === "OCCUPIED" && room.booking_type === "MOMENT"
          : statusFilter === "NIGHT"
          ? room.status === "OCCUPIED" && room.booking_type === "NIGHT"
          : room.status === statusFilter;

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
    setBookingType("MOMENT"); // Default to Moment 2h as common practice
    setMomentHours(room.moment_duration_hours || 2);
    setPaymentMethod("ESPECES");
    setCheckInModalOpen(true);
  };

  const calculatedCheckInPrice = useMemo(() => {
    if (!selectedRoomForCheckIn) return 0;
    if (bookingType === "NIGHT") {
      return selectedRoomForCheckIn.price_per_night || 3500;
    }
    // Moment calculation
    const basePrice = selectedRoomForCheckIn.price_per_moment || 1500;
    const baseDuration = selectedRoomForCheckIn.moment_duration_hours || 2;
    const extraHours = Math.max(0, momentHours - baseDuration);
    const extraCost = extraHours * (selectedRoomForCheckIn.extra_hour_price || 500);
    return basePrice + extraCost;
  }, [selectedRoomForCheckIn, bookingType, momentHours]);

  const handleConfirmCheckIn = () => {
    if (!selectedRoomForCheckIn) return;
    if (!guestName.trim()) {
      return toast.error("Veuillez renseigner le nom du client");
    }

    const checkInTime = new Date();
    const expectedCheckOut =
      bookingType === "MOMENT"
        ? new Date(checkInTime.getTime() + momentHours * 60 * 60 * 1000).toISOString()
        : new Date(checkInTime.getTime() + 18 * 60 * 60 * 1000).toISOString(); // ~翌朝

    barRestoService.addBooking(effectiveBranchId, {
      room_id: selectedRoomForCheckIn.id,
      room_number: selectedRoomForCheckIn.room_number,
      guest_name: guestName.trim(),
      guest_phone: guestPhone.trim(),
      booking_type: bookingType,
      duration_hours: bookingType === "MOMENT" ? momentHours : undefined,
      check_in: checkInTime.toISOString(),
      expected_check_out: expectedCheckOut,
      total_amount: calculatedCheckInPrice,
      paid_amount: calculatedCheckInPrice,
      payment_method: paymentMethod,
      payment_status: "PAID",
      status: "CHECKED_IN",
    });

    toast.success(
      `Check-in réussi ! Chambre ${selectedRoomForCheckIn.room_number} — ${
        bookingType === "MOMENT" ? `Moment ${momentHours}h` : "Nuitée complète"
      }`
    );
    setCheckInModalOpen(false);
    loadHotelData();
  };

  const handleExtendMoment = (room: HotelRoom) => {
    const currentExpected = room.expected_check_out ? new Date(room.expected_check_out) : new Date();
    const newExpected = new Date(currentExpected.getTime() + 60 * 60 * 1000).toISOString();
    const extraPrice = room.extra_hour_price || 500;

    barRestoService.updateRoomStatus(effectiveBranchId, room.id, "OCCUPIED", {
      name: room.current_guest_name || undefined,
      phone: room.current_guest_phone || undefined,
      checkIn: room.check_in_date || undefined,
      bookingType: "MOMENT",
      expectedCheckOut: newExpected,
    });

    toast.success(`Chambre ${room.room_number} prolongée de +1 Heure (${format(extraPrice)}) !`);
    loadHotelData();
  };

  const handleCheckOut = (room: HotelRoom) => {
    barRestoService.checkOutRoom(effectiveBranchId, room.id);
    toast.info(`Chambre ${room.room_number} libérée et passée en statut "Nettoyage"`);
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
      price_per_moment: Number(newPriceMoment) || 1500,
      moment_duration_hours: 2,
      extra_hour_price: Number(newExtraHourPrice) || 500,
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

  const getRemainingTimeBadge = (expectedCheckout?: string | null) => {
    if (!expectedCheckout) return null;
    const diffMs = new Date(expectedCheckout).getTime() - now;
    const diffMinutes = Math.round(diffMs / (60 * 1000));

    if (diffMinutes > 0) {
      const h = Math.floor(diffMinutes / 60);
      const m = diffMinutes % 60;
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/30">
          <Timer className="h-3.5 w-3.5 animate-pulse text-amber-600" />
          <span>
            Reste {h > 0 ? `${h}h ` : ""}{m} min (Fin {new Date(expectedCheckout).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
          </span>
        </div>
      );
    } else {
      const overdueMins = Math.abs(diffMinutes);
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-destructive/15 text-destructive font-black text-xs border border-destructive/40 animate-pulse">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>TEMPS DÉPASSÉ de {overdueMins} min (+heure supp.)</span>
        </div>
      );
    }
  };

  return (
    <DashboardLayout
      role="salon_admin"
      title="Hôtel & Chambres"
      subtitle="Gestion des chambres, séjours de passage (Moments 2h) et nuitées (Bar, Resto & Hôtel)"
    >
      <StaggerContainer className="space-y-6">
        {/* KPI Cards */}
        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="border-border/60 shadow-sm bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">
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
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wide">
                    Disponibles
                  </p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {stats.available}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500/70" />
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wide flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" /> Moments (Passage)
                  </p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {stats.momentsActive}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-amber-500/70" />
              </CardContent>
            </Card>

            <Card className="border-indigo-500/30 bg-indigo-500/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 font-bold uppercase tracking-wide flex items-center gap-1">
                    <Moon className="h-3.5 w-3.5" /> Nuitées en cours
                  </p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {stats.nightsActive}
                  </p>
                </div>
                <Bed className="h-8 w-8 text-indigo-500/70" />
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5 shadow-sm col-span-2 md:col-span-1">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary font-bold uppercase tracking-wide">
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
                  className="font-bold text-xs"
                >
                  Toutes ({stats.total})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "AVAILABLE" ? "default" : "outline"}
                  onClick={() => setStatusFilter("AVAILABLE")}
                  className="gap-1 font-bold text-xs"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Disponibles ({stats.available})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "MOMENT" ? "default" : "outline"}
                  onClick={() => setStatusFilter("MOMENT")}
                  className="gap-1 font-bold text-xs text-amber-600"
                >
                  <Timer className="h-3.5 w-3.5" /> En Moment 2h ({stats.momentsActive})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "NIGHT" ? "default" : "outline"}
                  onClick={() => setStatusFilter("NIGHT")}
                  className="gap-1 font-bold text-xs text-indigo-600"
                >
                  <Moon className="h-3.5 w-3.5" /> En Nuitée ({stats.nightsActive})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "CLEANING" ? "default" : "outline"}
                  onClick={() => setStatusFilter("CLEANING")}
                  className="gap-1 font-bold text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Nettoyage ({stats.cleaning})
                </Button>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Chambre 101, Deluxe, Client..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <Button size="sm" onClick={() => setNewRoomModalOpen(true)} className="gap-1 font-bold whitespace-nowrap">
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
              const isMoment = room.booking_type === "MOMENT";

              return (
                <Card
                  key={room.id}
                  className={`border transition-all hover:shadow-md ${
                    isOccupied
                      ? isMoment
                        ? "border-amber-300 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20"
                        : "border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/20"
                      : isCleaning
                      ? "border-slate-300 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20"
                      : "border-border/60 hover:border-emerald-400"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-base">
                          {room.room_number}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold">{room.room_type}</CardTitle>
                          <p className="text-xs text-muted-foreground">{room.floor}</p>
                        </div>
                      </div>

                      {isAvailable && (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 font-bold">Disponible</Badge>
                      )}
                      {isOccupied && isMoment && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 font-bold gap-1">
                          <Timer className="h-3 w-3" /> Moment
                        </Badge>
                      )}
                      {isOccupied && !isMoment && (
                        <Badge className="bg-indigo-600 hover:bg-indigo-700 font-bold gap-1">
                          <Moon className="h-3 w-3" /> Nuitée
                        </Badge>
                      )}
                      {isCleaning && (
                        <Badge className="bg-slate-600 font-bold gap-1">
                          <Sparkles className="h-3 w-3" /> Nettoyage
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    {/* Tarifs de la chambre : Moment vs Nuitée */}
                    <div className="grid grid-cols-2 gap-2 text-xs border-y py-2 border-border/50 bg-muted/20 px-2 rounded-lg">
                      <div>
                        <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                          ⏱️ Moment ({room.moment_duration_hours || 2}h)
                        </span>
                        <span className="font-black text-amber-700 dark:text-amber-400 text-sm">
                          {format(room.price_per_moment || 1500)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                          🌙 Nuitée
                        </span>
                        <span className="font-black text-primary text-sm">
                          {format(room.price_per_night || 3500)}
                        </span>
                      </div>
                    </div>

                    {/* Infos Client & Compteur si occupée */}
                    {isOccupied && (
                      <div className="rounded-lg p-2.5 space-y-2 text-xs border border-border/60 bg-background/80 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-foreground truncate">
                            <User className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate">{room.current_guest_name || "Client de passage"}</span>
                          </div>
                          {room.current_guest_phone && (
                            <span className="text-muted-foreground text-[11px]">{room.current_guest_phone}</span>
                          )}
                        </div>

                        {/* Compteur temps restant si Moment */}
                        {isMoment && getRemainingTimeBadge(room.expected_check_out)}

                        {room.check_in_date && (
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                            <span>Arrivée : {new Date(room.check_in_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMoment && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleExtendMoment(room)}
                                className="h-6 px-1.5 text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              >
                                +1h Supp. ({format(room.extra_hour_price || 500)})
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {isCleaning && (
                      <div className="rounded-lg bg-amber-500/10 p-2 text-xs flex items-center gap-2 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium">
                        <Sparkles className="h-4 w-4 shrink-0" />
                        <span>En cours de ménage et changement des draps.</span>
                      </div>
                    )}

                    {/* Actions */}
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
                          <LogOut className="h-4 w-4" /> Libérer la Chambre
                        </Button>
                      )}

                      {isCleaning && (
                        <Button
                          size="sm"
                          className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          onClick={() => handleMarkCleaned(room)}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Chambre Prête
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

      {/* Check-in Modal with Moment Support */}
      <Dialog open={checkInModalOpen} onOpenChange={setCheckInModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <Hotel className="h-5 w-5 text-primary" />
              Check-in Chambre {selectedRoomForCheckIn?.room_number}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedRoomForCheckIn?.room_type} — {selectedRoomForCheckIn?.floor}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Choix du type : Moment (2h) ou Nuitée */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Type de Location</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={bookingType === "MOMENT" ? "default" : "outline"}
                  onClick={() => setBookingType("MOMENT")}
                  className={`h-16 flex flex-col items-center justify-center border-2 ${
                    bookingType === "MOMENT" ? "border-primary" : ""
                  }`}
                >
                  <span className="font-bold text-xs flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" /> Moment / Passage
                  </span>
                  <span className="text-base font-black">
                    {format(selectedRoomForCheckIn?.price_per_moment || 1500)} (2h)
                  </span>
                </Button>

                <Button
                  type="button"
                  variant={bookingType === "NIGHT" ? "default" : "outline"}
                  onClick={() => setBookingType("NIGHT")}
                  className={`h-16 flex flex-col items-center justify-center border-2 ${
                    bookingType === "NIGHT" ? "border-primary" : ""
                  }`}
                >
                  <span className="font-bold text-xs flex items-center gap-1">
                    <Moon className="h-3.5 w-3.5" /> Nuitée Complète
                  </span>
                  <span className="text-base font-black">
                    {format(selectedRoomForCheckIn?.price_per_night || 3500)}
                  </span>
                </Button>
              </div>
            </div>

            {/* Si moment, choix du nombre d'heures */}
            {bookingType === "MOMENT" && (
              <div className="space-y-1.5 bg-muted/40 p-3 rounded-lg border">
                <div className="flex justify-between items-center">
                  <Label htmlFor="moment-h" className="text-xs font-bold">
                    Durée du séjour en heures :
                  </Label>
                  <span className="font-black text-primary text-sm">{momentHours} Heures</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[1, 2, 3, 4].map((h) => (
                    <Button
                      key={h}
                      type="button"
                      size="sm"
                      variant={momentHours === h ? "default" : "outline"}
                      className="h-8 font-bold text-xs"
                      onClick={() => setMomentHours(h)}
                    >
                      {h}h {h === 2 ? "(Standard)" : ""}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Départ prévu calculé à :{" "}
                  <strong className="text-foreground">
                    {new Date(Date.now() + momentHours * 3600 * 1000).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="guest-name" className="text-xs font-bold">Nom du Client *</Label>
              <Input
                id="guest-name"
                placeholder="Ex: Client de passage ou nom complet"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="guest-phone" className="text-xs font-bold">Téléphone (Optionnel)</Label>
                <Input
                  id="guest-phone"
                  placeholder="Ex: +509 37 00 00 00"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Moyen de paiement</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ESPECES">Espèces (Cash)</option>
                  <option value="MONCASH">MonCash</option>
                  <option value="CARTE">Carte Bancaire</option>
                  <option value="TRANSFERT">Virement</option>
                </select>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase block">Total à encaisser</span>
                <span className="text-xs font-semibold text-primary">
                  {bookingType === "MOMENT" ? `Moment de ${momentHours}h` : "Nuitée complète"}
                </span>
              </div>
              <span className="text-2xl font-black text-primary">
                {format(calculatedCheckInPrice)}
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
            <DialogTitle className="text-base font-bold">Ajouter une Chambre</DialogTitle>
            <DialogDescription className="text-xs">
              Configurez le numéro, type et les tarifs (Moment & Nuitée) de la chambre.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="room-num" className="text-xs font-bold">Numéro de Chambre *</Label>
                <Input
                  id="room-num"
                  placeholder="Ex: 104 ou VIP-2"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="room-floor" className="text-xs font-bold">Étage</Label>
                <Input
                  id="room-floor"
                  placeholder="Ex: 1er étage"
                  value={newFloor}
                  onChange={(e) => setNewFloor(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Type de Chambre</Label>
              <select
                value={newRoomType}
                onChange={(e) => setNewRoomType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Chambre Standard">Chambre Standard</option>
                <option value="Chambre Confort Deluxe">Chambre Confort Deluxe</option>
                <option value="Suite VIP Exécutive">Suite VIP Exécutive</option>
                <option value="Chambre Double Famille">Chambre Double Famille</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="price-moment" className="text-xs font-bold">Moment 2h (HTG)</Label>
                <Input
                  id="price-moment"
                  type="number"
                  value={newPriceMoment}
                  onChange={(e) => setNewPriceMoment(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price-night" className="text-xs font-bold">Nuitée (HTG)</Label>
                <Input
                  id="price-night"
                  type="number"
                  value={newPriceNight}
                  onChange={(e) => setNewPriceNight(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price-extra" className="text-xs font-bold">+1h Supp (HTG)</Label>
                <Input
                  id="price-extra"
                  type="number"
                  value={newExtraHourPrice}
                  onChange={(e) => setNewExtraHourPrice(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRoomModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateRoom} className="font-bold">
              Enregistrer la Chambre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
