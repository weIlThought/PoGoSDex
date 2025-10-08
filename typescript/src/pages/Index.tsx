import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { DeviceCard } from "@/components/DeviceCard";
import { DeviceModal } from "@/components/DeviceModal";
import { PGSharpInfo } from "@/components/PGSharpInfo";
import { NewsSection } from "@/components/NewsSection";
import { FAQSection } from "@/components/FAQSection";
import { AdminPanel } from "@/components/AdminPanel";
import { devices, Device } from "@/data/devices";
import translations from "@/data/translations.json";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

const Index = () => {
  const [lang, setLang] = useState<"en" | "de" | "ru">("en");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("brand");
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"devices" | "news" | "faq">("devices");
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const navigate = useNavigate();

  const t = translations[lang];

  // Load language and check auth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get("lang");
    const savedLang = localStorage.getItem("lang");
    
    if (langParam && ["en", "de", "ru"].includes(langParam)) {
      setLang(langParam as "en" | "de" | "ru");
      localStorage.setItem("lang", langParam);
    } else if (savedLang && ["en", "de", "ru"].includes(savedLang)) {
      setLang(savedLang as "en" | "de" | "ru");
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
        setShowAdminPanel(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (error) throw error;
      setIsAdmin(!!data);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowAdminPanel(false);
  };

  const handleLanguageChange = (newLang: string) => {
    setLang(newLang as "en" | "de" | "ru");
    localStorage.setItem("lang", newLang);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", newLang);
    window.history.pushState({}, "", url);
  };

  const filteredAndSortedDevices = useMemo(() => {
    let filtered = devices.filter((device) => {
      const matchesSearch =
        device.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.model.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = selectedType === "all" || device.type === selectedType;
      
      return matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      if (sortBy === "brand") {
        return a.brand.localeCompare(b.brand);
      } else if (sortBy === "model") {
        return a.model.localeCompare(b.model);
      } else if (sortBy === "osVersion") {
        return a.osVersion.localeCompare(b.osVersion);
      }
      return 0;
    });

    return filtered;
  }, [searchQuery, selectedType, sortBy]);

  const handleDeviceClick = (device: Device) => {
    setSelectedDevice(device);
    setModalOpen(true);
  };

  if (showAdminPanel && isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-hero text-foreground">
        <header className="border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
              <span className="font-bold text-xl">PokéHub</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdminPanel(false)}
              >
                {t.close}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t.logout}
              </Button>
            </div>
          </div>
        </header>
        <AdminPanel translations={t} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
            <span className="font-bold text-xl">PokéHub</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {isAdmin && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAdminPanel(true)}
                  >
                    <User className="h-4 w-4 mr-2" />
                    {t.admin}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t.logout}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/auth")}
              >
                {t.login}
              </Button>
            )}
            <LanguageSwitcher currentLang={lang} onLanguageChange={handleLanguageChange} />
          </div>
        </div>
      </header>

      {/* Hero Section with Tabs */}
      <section className="py-12 px-4 border-b border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6 mb-8 animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {t.title}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t.subtitle}
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex justify-center gap-2">
            <Button
              variant={activeTab === "devices" ? "default" : "outline"}
              onClick={() => setActiveTab("devices")}
            >
              {t.tabDevices}
            </Button>
            <Button
              variant={activeTab === "news" ? "default" : "outline"}
              onClick={() => setActiveTab("news")}
            >
              {t.tabNews}
            </Button>
            <Button
              variant={activeTab === "faq" ? "default" : "outline"}
              onClick={() => setActiveTab("faq")}
            >
              {t.tabFAQ}
            </Button>
          </div>
        </div>
      </section>

      {/* Content based on active tab */}
      {activeTab === "devices" && (
        <>
          <section className="pb-12 px-4 pt-12">
            <div className="container mx-auto max-w-6xl space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t.searchPlaceholder}
                />
                <FilterBar
                  selectedType={selectedType}
                  onTypeChange={setSelectedType}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  translations={t}
                />
              </div>
            </div>
          </section>

          <section className="pb-20 px-4">
            <div className="container mx-auto max-w-6xl">
              {filteredAndSortedDevices.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                  {filteredAndSortedDevices.map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      onClick={() => handleDeviceClick(device)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <p className="text-xl text-muted-foreground">{t.noResults}</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === "news" && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-center mb-8">{t.news}</h2>
            <NewsSection translations={t} />
          </div>
        </section>
      )}

      {activeTab === "faq" && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-center mb-8">{t.frequentlyAskedQuestions}</h2>
            <FAQSection translations={t} />
          </div>
        </section>
      )}

      {/* PGSharp Info Section */}
      <PGSharpInfo translations={t} />

      {/* Device Modal */}
      <DeviceModal
        device={selectedDevice}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        translations={t}
      />

      {/* Footer */}
      <footer className="border-t border-border bg-background/50 backdrop-blur-sm py-8 px-4 mt-20">
        <div className="container mx-auto max-w-6xl text-center text-muted-foreground">
          <p>© 2024 PokéHub. All device information is community-contributed.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
