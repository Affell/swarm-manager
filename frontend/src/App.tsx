import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SwarmNodes from "./pages/SwarmNodes";
import SwarmStack from "./pages/SwarmStack";
import SwarmCleanup from "./pages/SwarmCleanup";
import SwarmLogs from "./pages/SwarmLogs";
import ServiceDetail from "./pages/ServiceDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/swarm/nodes" element={<SwarmNodes />} />
          <Route path="/swarm/stack" element={<SwarmStack />} />
          <Route path="/swarm/cleanup" element={<SwarmCleanup />} />
          <Route path="/swarm/logs" element={<SwarmLogs />} />
          <Route path="/service/:id" element={<ServiceDetail />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
