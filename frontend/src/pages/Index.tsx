import { Link } from "react-router-dom";
import { SwarmLayout } from "@/components/SwarmLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Server,
  Activity,
  Package,
  Trash2,
  BarChart3,
  FileText,
} from "lucide-react";

const Index = () => {
  return (
    <SwarmLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Docker Swarm Manager
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Interface de gestion complète pour les clusters Docker Swarm.
            Surveillez les nœuds, gérez les services, consultez les logs et
            maintenez votre infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Server className="h-5 w-5 text-green-400" />
                <CardTitle className="text-lg text-white">Nœuds</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Surveiller les nœuds du cluster et leurs services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/swarm/nodes">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Voir les Nœuds
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-lg text-white">Stacks</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Gérer les stacks d'applications et services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/swarm/stack">
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  Gérer les Stacks
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Trash2 className="h-5 w-5 text-red-400" />
                <CardTitle className="text-lg text-white">Nettoyage</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Supprimer les ressources Docker inutilisées
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/swarm/cleanup">
                <Button className="w-full bg-red-600 hover:bg-red-700">
                  Nettoyer le Système
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-orange-400" />
                <CardTitle className="text-lg text-white">Logs</CardTitle>
              </div>
              <CardDescription className="text-gray-400">
                Consulter les logs en temps réel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/swarm/logs">
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  Voir les Logs
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-orange-400" />
                <CardTitle className="text-white">
                  Surveillance en temps réel
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                Consultez les logs en direct et surveillez votre cluster Docker
                Swarm en temps réel. Suivez les déploiements de services, les
                événements de conteneurs et la santé du système.
              </p>
              <Link to="/swarm/logs">
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Voir les Logs en Direct
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link to="/swarm/nodes" className="block">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-300 hover:bg-gray-700"
                  >
                    <Server className="h-4 w-4 mr-2" />
                    Vérifier l'état des nœuds
                  </Button>
                </Link>
                <Link to="/swarm/cleanup" className="block">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-300 hover:bg-gray-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Nettoyer les ressources inutilisées
                  </Button>
                </Link>
                <Link to="/swarm/logs" className="block">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-300 hover:bg-gray-700"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Surveiller les logs en direct
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SwarmLayout>
  );
};

export default Index;
