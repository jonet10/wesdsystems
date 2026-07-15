import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── PROVIDER INTERFACE ───
export interface WhatsAppProvider {
  sendMessage(
    apiUrl: string,
    apiKey: string,
    recipient: string,
    message: string,
    sessionName?: string
  ): Promise<{ success: boolean; errorMessage?: string }>;
}

// ─── 1. OPENWA PROVIDER ───
export class OpenWaProvider implements WhatsAppProvider {
  async sendMessage(apiUrl: string, apiKey: string, recipient: string, message: string, sessionName?: string) {
    try {
      const cleanedPhone = recipient.replace(/\D/g, "");
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          phone: cleanedPhone,
          message: message,
          session: sessionName || "default"
        })
      });
      if (!response.ok) {
        const txt = await response.text();
        return { success: false, errorMessage: `HTTP ${response.status}: ${txt}` };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, errorMessage: e.message };
    }
  }
}

// ─── 2. ULTRAMSG PROVIDER ───
export class UltraMsgProvider implements WhatsAppProvider {
  async sendMessage(apiUrl: string, apiKey: string, recipient: string, message: string) {
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: apiKey,
          to: recipient.replace(/\D/g, ""),
          body: message
        })
      });
      if (!response.ok) {
        const txt = await response.text();
        return { success: false, errorMessage: `HTTP ${response.status}: ${txt}` };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, errorMessage: e.message };
    }
  }
}

// ─── 3. META CLOUD PROVIDER ───
export class MetaCloudProvider implements WhatsAppProvider {
  async sendMessage(apiUrl: string, apiKey: string, recipient: string, message: string) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient.replace(/\D/g, ""),
          type: "text",
          text: { body: message }
        })
      });
      if (!response.ok) {
        const txt = await response.text();
        return { success: false, errorMessage: `HTTP ${response.status}: ${txt}` };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, errorMessage: e.message };
    }
  }
}

// ─── 4. TWILIO PROVIDER ───
export class TwilioProvider implements WhatsAppProvider {
  async sendMessage(apiUrl: string, apiKey: string, recipient: string, message: string, sessionName?: string) {
    try {
      const parts = apiKey.split(":");
      const sid = parts[0];
      const token = parts[1] || "";
      const sender = sessionName || "whatsapp:+14155238886";
      
      const params = new URLSearchParams();
      params.append("To", `whatsapp:+${recipient.replace(/\D/g, "")}`);
      params.append("From", sender.startsWith("whatsapp:") ? sender : `whatsapp:${sender}`);
      params.append("Body", message);

      const headers = new Headers();
      headers.set("Authorization", "Basic " + btoa(sid + ":" + token));
      headers.set("Content-Type", "application/x-www-form-urlencoded");

      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: params.toString()
      });
      if (!response.ok) {
        const txt = await response.text();
        return { success: false, errorMessage: `HTTP ${response.status}: ${txt}` };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, errorMessage: e.message };
    }
  }
}

// ─── SERVICE CLASS ───
export const whatsappService = {
  getProvider(providerName: string): WhatsAppProvider {
    switch (providerName) {
      case "ultramsg":
        return new UltraMsgProvider();
      case "meta":
        return new MetaCloudProvider();
      case "twilio":
        return new TwilioProvider();
      case "openwa":
      default:
        return new OpenWaProvider();
    }
  },

  async getSettings(businessId: string) {
    const { data, error } = await supabase
      .from("pharmacy_whatsapp_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async saveSettings(businessId: string, settings: any) {
    const { data: existing } = await supabase
      .from("pharmacy_whatsapp_settings")
      .select("id")
      .eq("business_id", businessId)
      .maybeSingle();

    let query;
    if (existing) {
      query = supabase
        .from("pharmacy_whatsapp_settings")
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      query = supabase
        .from("pharmacy_whatsapp_settings")
        .insert([{ ...settings, business_id: businessId }]);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async getLogs(businessId: string) {
    const { data, error } = await supabase
      .from("pharmacy_whatsapp_logs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // ─── ASYNC NON-BLOCKING SENDER ───
  sendWhatsAppMessageAsync(businessId: string, message: string, type: string, branchId?: string | null) {
    this.sendWhatsAppMessage(businessId, message, type, branchId).catch(err => {
      console.error("[WhatsApp Service] Background send error:", err);
    });
  },

  async sendWhatsAppMessage(
    businessId: string,
    message: string,
    type: string,
    branchId?: string | null
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      const settings = await this.getSettings(businessId);
      if (!settings || !settings.enabled || !settings.owner_phone) {
        return { success: false, errorMessage: "WhatsApp non configuré ou désactivé" };
      }

      // Check specific alert flags
      if (type === "sales_alert" && !settings.send_sales_alerts) return { success: false };
      if (type === "low_stock" && !settings.send_low_stock_alerts) return { success: false };
      if (type === "expiry" && !settings.send_expiry_alerts) return { success: false };
      if (type === "register_open" && !settings.send_register_alerts) return { success: false };
      if (type === "register_close" && !settings.send_register_alerts) return { success: false };
      if (type === "void_alert" && !settings.send_void_alerts) return { success: false };
      if (type === "return_alert" && !settings.send_return_alerts) return { success: false };
      if (type === "daily_report" && !settings.send_daily_report) return { success: false };
      if (type === "weekly_report" && !settings.send_weekly_report) return { success: false };
      if (type === "monthly_report" && !settings.send_monthly_report) return { success: false };

      // Load global WhatsApp config from platform
      const { data: globalConfigData } = await supabase.rpc("get_app_config");
      const globalConfig = globalConfigData || {};

      const isGlobalEnabled = globalConfig.whatsapp_global_enabled !== "false";
      if (!isGlobalEnabled) {
        return { success: false, errorMessage: "WhatsApp désactivé globalement par la plateforme" };
      }

      const providerName = globalConfig.whatsapp_global_provider || settings.provider || "openwa";
      let apiUrl = globalConfig.whatsapp_global_api_url || settings.api_url || "";
      if (!apiUrl || apiUrl === "default") {
        apiUrl = "http://localhost:3000";
      }
      const apiKey = globalConfig.whatsapp_global_api_key || settings.api_key || "";
      const sessionName = globalConfig.whatsapp_global_session_name || settings.session_name || "default";

      const provider = this.getProvider(providerName);
      const res = await provider.sendMessage(
        apiUrl,
        apiKey,
        settings.owner_phone,
        message,
        sessionName
      );

      // Log the notification
      await supabase.from("pharmacy_whatsapp_logs").insert([{
        business_id: businessId,
        branch_id: branchId || settings.branch_id || null,
        recipient: settings.owner_phone,
        message,
        type,
        status: res.success ? "sent" : "failed",
        error_message: res.errorMessage || null
      }]);

      return res;
    } catch (e: any) {
      console.error("[WhatsApp Service] Send error:", e);
      // Log the failure
      try {
        await supabase.from("pharmacy_whatsapp_logs").insert([{
          business_id: businessId,
          branch_id: branchId || null,
          recipient: "Configuration Error",
          message,
          type,
          status: "failed",
          error_message: e.message
        }]);
      } catch (logErr) {
        console.error("[WhatsApp Service] Logger failed:", logErr);
      }
      return { success: false, errorMessage: e.message };
    }
  },

  async retryMessage(logId: string) {
    const { data: log, error } = await supabase
      .from("pharmacy_whatsapp_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (error || !log) throw new Error("Log introuvable");

    const settings = await this.getSettings(log.business_id);
    if (!settings) throw new Error("Configuration client introuvable");

    const { data: globalConfigData } = await supabase.rpc("get_app_config");
    const globalConfig = globalConfigData || {};

    const providerName = globalConfig.whatsapp_global_provider || settings.provider || "openwa";
    let apiUrl = globalConfig.whatsapp_global_api_url || settings.api_url || "";
    if (!apiUrl || apiUrl === "default") {
      apiUrl = "http://localhost:3000";
    }
    const apiKey = globalConfig.whatsapp_global_api_key || settings.api_key || "";
    const sessionName = globalConfig.whatsapp_global_session_name || settings.session_name || "default";

    if (!apiUrl) {
      throw new Error("Configuration WhatsApp globale ou locale manquante");
    }

    const provider = this.getProvider(providerName);
    const res = await provider.sendMessage(
      apiUrl,
      apiKey,
      log.recipient,
      log.message,
      sessionName
    );

    // Update log status
    await supabase
      .from("pharmacy_whatsapp_logs")
      .update({
        status: res.success ? "sent" : "failed",
        error_message: res.errorMessage || null,
        created_at: new Date().toISOString()
      })
      .eq("id", logId);

    return res;
  },

  // ─── TEST MESSAGE SENDER ───
  async sendTestMessage(businessId: string, phone: string, settings: any) {
    const { data: globalConfigData } = await supabase.rpc("get_app_config");
    const globalConfig = globalConfigData || {};

    const providerName = settings.provider || globalConfig.whatsapp_global_provider || "openwa";
    let apiUrl = settings.api_url || globalConfig.whatsapp_global_api_url || "";
    if (!apiUrl || apiUrl === "default") {
      apiUrl = "http://localhost:3000";
    }
    const apiKey = settings.api_key || globalConfig.whatsapp_global_api_key || "";
    const sessionName = settings.session_name || globalConfig.whatsapp_global_session_name || "default";

    const provider = this.getProvider(providerName);
    const message = "🧪 Message de Test WesdSystems WhatsApp\n\nVotre connexion WhatsApp est correctement configurée et fonctionnelle !";
    const res = await provider.sendMessage(
      apiUrl,
      apiKey,
      phone,
      message,
      sessionName
    );

    // Log the test message
    await supabase.from("pharmacy_whatsapp_logs").insert([{
      business_id: businessId,
      branch_id: settings.branch_id || null,
      recipient: phone,
      message,
      type: "test",
      status: res.success ? "sent" : "failed",
      error_message: res.errorMessage || null
    }]);

    return res;
  },

  // ─── CRON FALLBACK : TRIGGER REPORTS CHECK ───
  async checkAndTriggerReports(businessId: string, branchId?: string | null) {
    try {
      const settings = await this.getSettings(businessId);
      if (!settings || !settings.enabled) return;

      const today = new Date().toISOString().split("T")[0];

      // 1. Daily Report Check (Send daily at or after 8 PM)
      if (settings.send_daily_report) {
        const { data: dailyLogs } = await supabase
          .from("pharmacy_whatsapp_logs")
          .select("id")
          .eq("business_id", businessId)
          .eq("type", "daily_report")
          .gte("created_at", `${today}T00:00:00.000Z`);

        const hour = new Date().getHours();
        if ((!dailyLogs || dailyLogs.length === 0) && hour >= 20) {
          // Trigger Daily Report
          await this.triggerDailyReport(businessId, branchId);
        }
      }

      // 2. Weekly Report Check (Send weekly on Sunday after 8 PM)
      if (settings.send_weekly_report) {
        const dayOfWeek = new Date().getDay(); // 0 is Sunday
        const hour = new Date().getHours();
        
        if (dayOfWeek === 0 && hour >= 20) {
          // Get start of today (Sunday)
          const { data: weeklyLogs } = await supabase
            .from("pharmacy_whatsapp_logs")
            .select("id")
            .eq("business_id", businessId)
            .eq("type", "weekly_report")
            .gte("created_at", `${today}T00:00:00.000Z`);

          if (!weeklyLogs || weeklyLogs.length === 0) {
            await this.triggerWeeklyReport(businessId, branchId);
          }
        }
      }

      // 3. Monthly Report Check (Send monthly on the 1st of the month)
      if (settings.send_monthly_report) {
        const dayOfMonth = new Date().getDate();
        if (dayOfMonth === 1) {
          const { data: monthlyLogs } = await supabase
            .from("pharmacy_whatsapp_logs")
            .select("id")
            .eq("business_id", businessId)
            .eq("type", "monthly_report")
            .gte("created_at", `${today}T00:00:00.000Z`);

          if (!monthlyLogs || monthlyLogs.length === 0) {
            await this.triggerMonthlyReport(businessId, branchId);
          }
        }
      }
    } catch (err) {
      console.error("[WhatsApp Service] Cron trigger error:", err);
    }
  },

  // ─── REPORT GENERATORS ───
  async triggerDailyReport(businessId: string, branchId?: string | null) {
    try {
      const todayStart = `${new Date().toISOString().split("T")[0]}T00:00:00.000Z`;
      
      const [salesRes, productsRes, batchesRes, bizRes] = await Promise.all([
        supabase.from("pharmacy_sales").select("total, created_at").eq("business_id", businessId).gte("created_at", todayStart),
        supabase.from("pharmacy_products").select("name, total_stock_quantity, min_stock_alert").eq("business_id", businessId),
        supabase.from("pharmacy_batches").select("current_quantity, cost_price, sale_price, expiration_date").eq("business_id", businessId).gt("current_quantity", 0),
        supabase.from("businesses").select("name").eq("id", businessId).single()
      ]);

      const sales = salesRes.data || [];
      const products = productsRes.data || [];
      const batches = batchesRes.data || [];
      const bizName = bizRes.data?.name || "Pharmacie";

      const totalSalesAmt = sales.reduce((acc, s) => acc + Number(s.total || 0), 0);
      const transactionCount = sales.length;

      // Estimate profit, stock value
      let stockValue = 0;
      batches.forEach(b => {
        stockValue += Number(b.current_quantity) * Number(b.cost_price || 0);
      });

      // Low stock & expiry
      const lowStockCount = products.filter(p => Number(p.total_stock_quantity) <= Number(p.min_stock_alert)).length;
      
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
      const expiringSoonCount = batches.filter(b => new Date(b.expiration_date) <= ninetyDaysFromNow).length;

      const dateStr = format(new Date(), "dd MMMM yyyy", { locale: fr });
      const timeStr = format(new Date(), "HH:mm");

      const message = `📊 RAPPORT QUOTIDIEN - ${bizName}

Date : ${dateStr} à ${timeStr}

💰 Ventes du jour : ${totalSalesAmt.toLocaleString()} HTG
🧾 Transactions : ${transactionCount}
👥 Clients servis : ${transactionCount} (approx)

⚠️ Stock faible : ${lowStockCount} produits
📦 Produits expirant bientôt : ${expiringSoonCount} lots
💼 Valeur du stock : ${stockValue.toLocaleString()} HTG

WesdSystems Pharmacy`;

      await this.sendWhatsAppMessage(businessId, message, "daily_report", branchId);
    } catch (e) {
      console.error("[WhatsApp Service] Daily report generation failed:", e);
    }
  },

  async triggerWeeklyReport(businessId: string, branchId?: string | null) {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const dateLimit = oneWeekAgo.toISOString();

      const [salesRes, productsRes, bizRes] = await Promise.all([
        supabase.from("pharmacy_sales").select("total, created_at").eq("business_id", businessId).gte("created_at", dateLimit),
        supabase.from("pharmacy_products").select("name, total_stock_quantity, min_stock_alert").eq("business_id", businessId),
        supabase.from("businesses").select("name").eq("id", businessId).single()
      ]);

      const sales = salesRes.data || [];
      const products = productsRes.data || [];
      const bizName = bizRes.data?.name || "Pharmacie";

      const totalSalesAmt = sales.reduce((acc, s) => acc + Number(s.total || 0), 0);
      const transactionCount = sales.length;

      const lowStockCount = products.filter(p => Number(p.total_stock_quantity) <= Number(p.min_stock_alert)).length;

      const message = `📊 RAPPORT HEBDOMADAIRE - ${bizName}

Semaine du : ${format(oneWeekAgo, "dd/MM/yyyy")} au ${format(new Date(), "dd/MM/yyyy")}

💰 Chiffre d'affaires : ${totalSalesAmt.toLocaleString()} HTG
🧾 Transactions : ${transactionCount}
⚠️ Produits stock faible : ${lowStockCount}

WesdSystems Pharmacy`;

      await this.sendWhatsAppMessage(businessId, message, "weekly_report", branchId);
    } catch (e) {
      console.error("[WhatsApp Service] Weekly report generation failed:", e);
    }
  },

  async triggerMonthlyReport(businessId: string, branchId?: string | null) {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      const dateLimit = oneMonthAgo.toISOString();

      const [salesRes, productsRes, bizRes] = await Promise.all([
        supabase.from("pharmacy_sales").select("total, created_at").eq("business_id", businessId).gte("created_at", dateLimit),
        supabase.from("pharmacy_products").select("name, total_stock_quantity, min_stock_alert").eq("business_id", businessId),
        supabase.from("businesses").select("name").eq("id", businessId).single()
      ]);

      const sales = salesRes.data || [];
      const products = productsRes.data || [];
      const bizName = bizRes.data?.name || "Pharmacie";

      const totalSalesAmt = sales.reduce((acc, s) => acc + Number(s.total || 0), 0);
      const transactionCount = sales.length;

      const message = `📊 RAPPORT MENSUEL - ${bizName}

Mois : ${format(new Date(), "MMMM yyyy", { locale: fr })}

💰 Ventes totales : ${totalSalesAmt.toLocaleString()} HTG
🧾 Nombre de ventes : ${transactionCount}
⚠️ Produits stock faible : ${products.filter(p => Number(p.total_stock_quantity) <= Number(p.min_stock_alert)).length}

WesdSystems Pharmacy`;

      await this.sendWhatsAppMessage(businessId, message, "monthly_report", branchId);
    } catch (e) {
      console.error("[WhatsApp Service] Monthly report generation failed:", e);
    }
  }
};
