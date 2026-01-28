'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, Star, CheckCircle2, Settings, Trash2, Power, PowerOff, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
  };
  category: string;
  tags: string[];
  icon?: string;
  isOfficial: boolean;
  isInstalled: boolean;
  isEnabled: boolean;
  downloads?: number;
  rating?: number;
}

export default function MarketplacePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [marketplacePlugins, setMarketplacePlugins] = useState<Plugin[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<Plugin[]>([]);
  const [featuredPlugins, setFeaturedPlugins] = useState<Plugin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('marketplace');

  const loadMarketplacePlugins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/plugins?source=marketplace');
      if (!res.ok) throw new Error('Failed to load marketplace');

      const data = await res.json();
      setMarketplacePlugins(data.data.plugins || []);
      setFeaturedPlugins(data.data.featured || []);
    } catch (error) {
      console.error('Error loading marketplace:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load marketplace',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadInstalledPlugins = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/plugins?source=installed');
      if (!res.ok) throw new Error('Failed to load installed plugins');

      const data = await res.json();
      setInstalledPlugins(data.data.plugins || []);
    } catch (error) {
      console.error('Error loading installed plugins:', error);
    }
  }, []);

  useEffect(() => {
    loadMarketplacePlugins();
    loadInstalledPlugins();
  }, [loadMarketplacePlugins, loadInstalledPlugins]);

  async function installPlugin(pluginId: string) {
    try {
      const res = await fetch('/api/admin/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId }),
      });

      if (!res.ok) throw new Error('Failed to install plugin');

      toast({
        title: 'Plugin Installed',
        description: 'Plugin has been installed successfully',
      });

      await loadInstalledPlugins();
      await loadMarketplacePlugins();
    } catch (error) {
      console.error('Error installing plugin:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to install plugin',
      });
    }
  }

  async function togglePlugin(pluginId: string, enable: boolean) {
    try {
      const action = enable ? 'enable' : 'disable';
      const res = await fetch(`/api/admin/plugins/${pluginId}?action=${action}`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error(`Failed to ${action} plugin`);

      toast({
        title: enable ? 'Plugin Enabled' : 'Plugin Disabled',
        description: `Plugin has been ${enable ? 'enabled' : 'disabled'} successfully`,
      });

      await loadInstalledPlugins();
    } catch (error) {
      console.error('Error toggling plugin:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to toggle plugin',
      });
    }
  }

  async function uninstallPlugin(pluginId: string) {
    if (!confirm('Are you sure you want to uninstall this plugin?')) return;

    try {
      const res = await fetch(`/api/admin/plugins/${pluginId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to uninstall plugin');

      toast({
        title: 'Plugin Uninstalled',
        description: 'Plugin has been uninstalled successfully',
      });

      await loadInstalledPlugins();
      await loadMarketplacePlugins();
    } catch (error) {
      console.error('Error uninstalling plugin:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to uninstall plugin',
      });
    }
  }

  const filteredPlugins = marketplacePlugins.filter(plugin => {
    const matchesSearch =
      searchQuery === '' ||
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Plugin Marketplace</h1>
        <p className="text-muted-foreground mt-2">
          Extend Conduit with community plugins and integrations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="installed">
            Installed ({installedPlugins.length})
          </TabsTrigger>
        </TabsList>

        {/* Marketplace Tab */}
        <TabsContent value="marketplace" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search plugins..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  className="border rounded-md px-3 py-2"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="notification">Notifications</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="analytics">Analytics</option>
                  <option value="logging">Logging</option>
                  <option value="security">Security</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Featured Plugins */}
          {searchQuery === '' && selectedCategory === 'all' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Featured Plugins</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {featuredPlugins.map(plugin => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    onInstall={() => installPlugin(plugin.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Plugins */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              {searchQuery || selectedCategory !== 'all' ? 'Search Results' : 'All Plugins'}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPlugins.map(plugin => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  onInstall={() => installPlugin(plugin.id)}
                />
              ))}
            </div>

            {filteredPlugins.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No plugins found matching your criteria</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Installed Tab */}
        <TabsContent value="installed" className="space-y-6">
          {installedPlugins.length > 0 ? (
            <div className="space-y-4">
              {installedPlugins.map(plugin => (
                <Card key={plugin.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        {plugin.icon && (
                          <div className="text-4xl">{plugin.icon}</div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{plugin.name}</h3>
                            <Badge variant={plugin.isEnabled ? 'default' : 'secondary'}>
                              {plugin.isEnabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                            {plugin.isOfficial && (
                              <Badge variant="outline">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Official
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {plugin.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {plugin.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => togglePlugin(plugin.id, !plugin.isEnabled)}
                        >
                          {plugin.isEnabled ? (
                            <>
                              <PowerOff className="h-4 w-4 mr-1" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4 mr-1" />
                              Enable
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => uninstallPlugin(plugin.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p className="mb-4">No plugins installed yet</p>
                <Button onClick={() => setActiveTab('marketplace')}>
                  Browse Marketplace
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PluginCard({ plugin, onInstall }: { plugin: Plugin; onInstall: () => void }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {plugin.icon && (
              <div className="text-3xl">{plugin.icon}</div>
            )}
            <div>
              <CardTitle className="text-lg">{plugin.name}</CardTitle>
              <CardDescription className="text-xs">{plugin.author.name}</CardDescription>
            </div>
          </div>
          {plugin.isOfficial && (
            <Badge variant="outline" className="text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Official
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground mb-4 flex-1">
          {plugin.description}
        </p>

        <div className="flex flex-wrap gap-1 mb-4">
          {plugin.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            <span>{plugin.downloads?.toLocaleString() || 0}</span>
          </div>
          {plugin.rating && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>{plugin.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        <Button
          onClick={onInstall}
          disabled={plugin.isInstalled}
          className="w-full"
        >
          {plugin.isInstalled ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Installed
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Install
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
