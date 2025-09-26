import { Actor } from 'apify';
import axios from 'axios';

await Actor.init();

// Get venues from input
const input = await Actor.getInput();
const { venues } = input;

if (!venues || venues.length === 0) {
    throw new Error("No venues provided in input.");
}

// Helper: Search Instagram location ID by venue name
async function getLocationId(venueName) {
    const searchUrl = `https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(venueName)}&rank_token=0.3953592318270893&include_reel=true`;
    const res = await axios.get(searchUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const places = res.data.places || [];
    if (places.length > 0) {
        return places[0].place.location.pk; // location ID
    }
    return null;
}

// Helper: Get story posters from location ID
async function getStoryProfiles(locationId) {
    const url = `https://i.instagram.com/api/v1/locations/${locationId}/story/`;
    const res = await axios.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "x-ig-app-id": "936619743392459"
        }
    });

    const items = res.data.reel?.items || [];
    const profiles = [];

    for (const item of items) {
        if (item.user) {
            profiles.push({
                handle: item.user.username,
                url: `https://instagram.com/${item.user.username}`,
                locationId
            });
        }
    }

    return profiles;
}

const allResults = [];

for (const venue of venues) {
    console.log(`Processing venue: ${venue}`);
    const locationId = await getLocationId(venue);

    if (!locationId) {
        console.log(`❌ Could not find location ID for ${venue}`);
        continue;
    }

    const profiles = await getStoryProfiles(locationId);

    for (const p of profiles) {
        await Actor.pushData({
            venue,
            ...p
        });
        allResults.push({ venue, ...p });
    }
}

console.log("✅ Finished. Saved profiles to dataset.");

// Graceful shutdown
await Actor.exit();
