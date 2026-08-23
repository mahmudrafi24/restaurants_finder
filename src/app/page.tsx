import { SearchExperience } from "@/components/search/search-experience";

/**
 * The application's only page.
 *
 * Kept as a server component so the heading and copy are in the initial HTML; everything stateful
 * lives in `SearchExperience`, which is the single client boundary.
 */
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-10 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Find every cafe and restaurant in a city
        </h1>
        <p className="text-muted-foreground mt-3 text-base text-pretty sm:text-lg">
          Search OpenStreetMap for cafes, restaurants and fast-food places around any city centre,
          then download the whole list as a spreadsheet.
        </p>
      </header>

      <SearchExperience />
    </div>
  );
}
