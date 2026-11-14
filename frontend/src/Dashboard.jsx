import { useTrips } from './hooks/useTrips';

export default function Dashboard() {
    const { data } = useTrips();
    const trips = data?.trips || [];

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-[#E3E8E1] rounded-2xl flex items-center justify-center mb-6">
                <span className="text-2xl">🌍</span>
            </div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">Welcome to GoLocal</h1>
            <p className="text-stone-500 max-w-md text-sm leading-relaxed mb-8">
                {trips.length > 0 
                    ? "Select a trip from the sidebar to view the itinerary, manage the crew, and chat live." 
                    : "You don't have any active trips. Click the + New button in the sidebar to start planning your next local getaway."}
            </p>
        </div>
    );
}