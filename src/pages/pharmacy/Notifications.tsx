import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, Search, Send, CheckCircle, XCircle, BellRing } from "lucide-react";
import { usePharmacyBusinessId } from "@/modules/pharmacy/hooks/usePharmacyBusinessId";
import { whatsappService } from "@/modules/pharmacy/services/whatsappService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface WhatsappLog {
  id: string;
  recipient: string;
  message: string;
  type: string;
  status: "sent" | "failed";
  error_message: string | null;
  created_at: string;
}

export default function PharmacyNotifications() {
  const businessId = usePharmacyBusinessId();

  const [logs, setLogs] = useState<WhatsappLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    if (businessId) {
      loadLogs();
    }
  }, [businessId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await whatsappService.getLogs(businessId!);
      setLogs(data);
    } catch (e: any) {
      toast.error("Erreur lors de la récupération des historiques : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (logId: string) => {
    setRetryingId(logId);
    try {
      const res = await whatsappService.retryMessage(logId);
      if (res.success) {
        toast.success("Notification renvoyée avec succès !");
        loadLogs(); // Reload logs to reflect the new state
      } else {
        toast.error("Échec du renvoi : " + res.errorMessage);
      }
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setRetryingId(null);
    }
  };

  const getAlertLabel = (type: string) => {
    switch (type) {
      case "test": return "Test de Connexion";
      case "daily_report": return "Rapport Quotidien";
      case "weekly_report": return "Rapport Hebdomadaire";
      case "monthly_report": return "Rapport Mensuel";
      case "low_stock": return "Stock Faible / Rupture";
      case "expiry": return "Péremption Produit";
      case "sales_alert": return "Grosse Vente";
      case "register_open": return "Ouverture de Caisse";
      case "register_close": return "Fermeture de Caisse";
      case "void_alert": return "Annulation de Vente";
      case "return_alert": return "Retour Produit";
      default: return type;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "low_stock":
      case "expiry":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      case "daily_report":
      case "weekly_report":
      case "monthly_report":
        return "bg-cyan-500/10 text-cyan-600 border-cyan-500/20";
      case "sales_alert":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "register_open":
      case "register_close":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "void_alert":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.recipient.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <DashboardLayout role="salon_admin" title="Alertes & Historique WhatsApp" subtitle="Suivi des notifications automatiques expédiées">
      <StaggerContainer className="p-6 space-y-6">
        
        <StaggerItem>
          <Card className="shadow-sm border border-purple-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-purple-600" />
                  Historique des messages envoyés
                </CardTitle>
                <CardDescription>
                  Consultez les rapports de livraison de toutes les alertes système.
                </CardDescription>
              </div>
              <Button variant="outline" size="icon" onClick={loadLogs} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* FILTRES & RECHERCHE */}
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher par message ou destinataire..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tous statuts" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      <SelectItem value="sent">Envoyés</SelectItem>
                      <SelectItem value="failed">Échoués</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tous types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous types d'alertes</SelectItem>
                      <SelectItem value="sales_alert">Grosses Ventes</SelectItem>
                      <SelectItem value="low_stock">Stock Faible / Ruptures</SelectItem>
                      <SelectItem value="expiry">Dates de Péremption</SelectItem>
                      <SelectItem value="register_open">Ouvertures Caisse</SelectItem>
                      <SelectItem value="register_close">Fermetures Caisse</SelectItem>
                      <SelectItem value="void_alert">Annulations de Ventes</SelectItem>
                      <SelectItem value="return_alert">Retours Produits</SelectItem>
                      <SelectItem value="daily_report">Rapports Quotidiens</SelectItem>
                      <SelectItem value="weekly_report">Rapports Hebdomadaires</SelectItem>
                      <SelectItem value="monthly_report">Rapports Mensuels</SelectItem>
                      <SelectItem value="test">Test de Connexion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* TABLEAU DES LOGS */}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/55">
                      <TableHead>Date & Heure</TableHead>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Type d'Alerte</TableHead>
                      <TableHead className="max-w-md">Message Envoyé</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                          {loading ? "Chargement de l'historique..." : "Aucune notification trouvée"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map(log => (
                        <TableRow key={log.id} className="hover:bg-gray-50/20 transition-colors">
                          <TableCell className="whitespace-nowrap font-medium text-xs">
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: fr })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.recipient}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${getTypeBadgeColor(log.type)}`}>
                              {getAlertLabel(log.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md font-mono text-[10px] whitespace-pre-wrap leading-relaxed py-3 text-gray-700 dark:text-gray-300">
                            {log.message}
                          </TableCell>
                          <TableCell>
                            {log.status === "sent" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5 py-0.5 px-2.5">
                                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                Envoyé
                              </Badge>
                            ) : (
                              <div className="space-y-1">
                                <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 gap-1.5 py-0.5 px-2.5">
                                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                                  Échoué
                                </Badge>
                                {log.error_message && (
                                  <p className="text-[10px] text-rose-500 max-w-[150px] truncate" title={log.error_message}>
                                    {log.error_message}
                                  </p>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRetry(log.id)}
                              disabled={retryingId === log.id}
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 shrink-0 gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {retryingId === log.id ? "Renvoi..." : "Réessayer"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

            </CardContent>
          </Card>
        </StaggerItem>

      </StaggerContainer>
    </DashboardLayout>
  );
}
