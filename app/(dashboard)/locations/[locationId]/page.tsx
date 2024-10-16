"use client";

import { useEffect, useState } from "react";
import { database } from "@/lib/firebase";
import { ref } from "firebase/database";
import { CardContent } from "@/components/ui/card";
import { Card } from "@/components/ui/card";
import { momentAgo } from "@/lib/momentAgo";
import { onValue } from "firebase/database";

import { CardHeader } from "@/components/ui/card";
import { CardTitle } from "@/components/ui/card";

import dynamic from 'next/dynamic';

import { Location } from "@/components/interfaces/location.interface";
import { Monitor } from "lucide-react";
import { User } from "lucide-react";
import { Link } from "lucide-react";
import { Smartphone } from "lucide-react";
import { Maximize2 } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { Clock } from "lucide-react";



interface InfoItemProps {
    icon: React.ReactNode;
    label: string;
    value: string | number | undefined;
}

const InfoItem: React.FC<InfoItemProps> = ({ icon, label, value }) => (
    <div className="flex items-start gap-2">
        {icon}
        <div>
            <p className="font-medium">{label}</p>
            <p className="text-muted-foreground">{value}</p>
        </div>
    </div>
);

import { MapPin, Globe, Calendar, RefreshCw, Tag } from "lucide-react";

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <p>Loading...</p>,
});


export default function LocationPage({
    params: { locationId }
}: {
    params: { locationId: string }
}) {

    const [location, setLocation] = useState<Location | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (locationId) {
            const locationRef = ref(database, `locations/${locationId}`);
            onValue(locationRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    setLocation({ ...data, id: locationId });
                    setLoading(false);
                } else {
                    setError(null);
                    setLoading(false);
                }
            }, (error) => {
                setError(error.message);
                setLoading(false);
            });
        }
    }, [locationId]);

    if (loading) {
        return <p>Loading...</p>;
    }

    if (error) {
        return <p>Error: {error}</p>;
    }

    return (
        <div className="flex w-full">
            <Card className="mt-4 w-full shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Location Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 w-full flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <InfoItem icon={<Globe className="h-4 w-4" />} label="IP" value={location?.ip || ''} />
                                    <InfoItem icon={<MapPin className="h-4 w-4" />} label="Coordinates" value={`${location?.latitude?.toFixed(6)}, ${location?.longitude?.toFixed(6)}`} />
                                    <InfoItem icon={<User className="h-4 w-4" />} label="User ID" value={location?.userId || ''} />
                                    <InfoItem icon={<Link className="h-4 w-4" />} label="Share Link ID" value={location?.shareLinkId || ''} />
                                    <InfoItem icon={<Smartphone className="h-4 w-4" />} label="Device ID" value={location?.deviceId || ''} />
                                    <InfoItem icon={<Monitor className="h-4 w-4" />} label="Device Type" value={location?.deviceType || ''} />
                                        <InfoItem icon={<Globe className="h-4 w-4" />} label="User Agent" value={location?.userAgent || ''} />
                                </div>
                                <div className="space-y-2">
                                    <InfoItem icon={<Maximize2 className="h-4 w-4" />} label="Screen Size" value={`${location?.screenWidth}x${location?.screenHeight}`} />
                                    <InfoItem icon={<ExternalLink className="h-4 w-4" />} label="Referrer" value={location?.referrer} />
                                    <InfoItem icon={<Globe className="h-4 w-4" />} label="User Language" value={location?.userLanguage} />
                                    <InfoItem icon={<Clock className="h-4 w-4" />} label="User Timezone" value={location?.userTimezone} />
                                    <InfoItem icon={<RefreshCw className="h-4 w-4" />} label="Updated" value={momentAgo(location?.updatedAt || 0)} />
                                    <InfoItem icon={<Calendar className="h-4 w-4" />} label="Created" value={momentAgo(location?.createdAt || 0)} />
                                    <InfoItem icon={<Tag className="h-4 w-4" />} label="Nickname" value={location?.nickname || ''} />
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col w-full justify-start space-x-2">
                        <div className="space-y-2">
                            <div className="mt-6">
                                <h3 className="text-lg font-semibold mb-2">Location on Map</h3>
                            </div>
                            {
                                location && (
                                    <Map 
                                        userLocations={[{
                                            id: location?.id,
                                            latitude: location?.latitude,
                                            longitude: location?.longitude,
                                            userId: '1',
                                        }]} 
                                        center={[location?.latitude || 0, location?.longitude || 0]}
                                        zoom={12}
                                    />
                                )
                            }
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
