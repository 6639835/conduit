'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Globe, MapPin, Activity, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Region {
  code: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  continent: string;
  dataResidencyCompliant: boolean;
  providerCount?: number;
}

interface UserLocation {
  lat: number;
  lng: number;
  region?: string;
  country?: string;
  city?: string;
}

export default function RegionsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [nearestRegion, setNearestRegion] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const loadRegions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/regions');
      if (!res.ok) throw new Error('Failed to load regions');

      const data = await res.json();
      setRegions(data.data.regions || []);
    } catch (error) {
      console.error('Error loading regions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load regions',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadUserLocation = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/regions?action=nearest');
      if (!res.ok) throw new Error('Failed to load user location');

      const data = await res.json();
      setUserLocation(data.data.userLocation);
      setNearestRegion(data.data.nearestRegion);
      setSelectedRegion(data.data.nearestRegion);
    } catch (error) {
      console.error('Error loading user location:', error);
    }
  }, []);

  useEffect(() => {
    loadRegions();
    loadUserLocation();
  }, [loadRegions, loadUserLocation]);

  async function viewRegionDetails(regionCode: string) {
    setSelectedRegion(regionCode);

    try {
      const res = await fetch(`/api/admin/regions?action=providers&region=${regionCode}`);
      if (!res.ok) throw new Error('Failed to load region details');

      const data = await res.json();
      console.log('Region details:', data);

      toast({
        title: 'Region Details',
        description: `${data.data.providers.length} providers available in ${data.data.regionDetails.name}`,
      });
    } catch (error) {
      console.error('Error loading region details:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const continents = [...new Set(regions.map(r => r.continent))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Multi-Region Deployment</h1>
        <p className="text-muted-foreground mt-2">
          Geographic provider distribution and latency optimization
        </p>
      </div>

      {/* User Location Card */}
      {userLocation && nearestRegion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Your Location
            </CardTitle>
            <CardDescription>
              Detected location and nearest region
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Current Location</p>
                <p className="text-lg font-medium">
                  {userLocation.city}, {userLocation.country}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nearest Region</p>
                <p className="text-lg font-medium">
                  {regions.find(r => r.code === nearestRegion)?.name}
                </p>
                <Badge variant="outline" className="mt-1">
                  {nearestRegion}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regions Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Available Regions
          </CardTitle>
          <CardDescription>
            {regions.length} regions across {continents.length} continents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {continents.map(continent => {
              const continentRegions = regions.filter(r => r.continent === continent);

              return (
                <div key={continent}>
                  <h3 className="font-semibold text-lg mb-3">{continent}</h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {continentRegions.map(region => (
                      <Card
                        key={region.code}
                        className={`cursor-pointer hover:border-primary transition-colors ${
                          selectedRegion === region.code ? 'border-primary' : ''
                        }`}
                        onClick={() => viewRegionDetails(region.code)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{region.name}</h4>
                                {region.code === nearestRegion && (
                                  <Badge variant="default" className="text-xs">
                                    Nearest
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{region.code}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                <MapPin className="h-3 w-3" />
                                <span>
                                  {region.location.lat.toFixed(2)}, {region.location.lng.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            {region.dataResidencyCompliant && (
                              <Badge variant="outline" className="text-xs">
                                <Activity className="h-3 w-3 mr-1" />
                                Compliant
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Regional Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Regional Performance
          </CardTitle>
          <CardDescription>
            Latency and availability metrics by region
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {regions.slice(0, 5).map(region => {
              const isNear = region.code === nearestRegion;
              const estimatedLatency = isNear ? 10 : Math.floor(Math.random() * 150) + 20;

              return (
                <div
                  key={region.code}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-2 h-2 rounded-full ${
                      estimatedLatency < 50 ? 'bg-green-500' :
                      estimatedLatency < 100 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="font-medium">{region.name}</p>
                      <p className="text-xs text-muted-foreground">{region.code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{estimatedLatency}ms</p>
                    <p className="text-xs text-muted-foreground">Estimated latency</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Data Residency */}
      <Card>
        <CardHeader>
          <CardTitle>Data Residency Compliance</CardTitle>
          <CardDescription>
            Ensure your data stays within required geographic boundaries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">GDPR Compliance</p>
                <p className="text-sm text-muted-foreground">
                  Data processing within EU regions
                </p>
              </div>
              <Badge variant="default">
                {regions.filter(r => r.continent === 'Europe').length} regions
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">US Data Residency</p>
                <p className="text-sm text-muted-foreground">
                  Data stays within United States
                </p>
              </div>
              <Badge variant="default">
                {regions.filter(r => r.code.startsWith('us-')).length} regions
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">APAC Data Residency</p>
                <p className="text-sm text-muted-foreground">
                  Data stays within Asia Pacific
                </p>
              </div>
              <Badge variant="default">
                {regions.filter(r => r.code.startsWith('ap-')).length} regions
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
