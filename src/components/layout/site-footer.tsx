export function SiteFooter() {
  return (
    <footer className="mt-12 border-t">
      <div className="text-muted-foreground mx-auto max-w-7xl px-4 py-6 text-xs sm:px-6 lg:px-8">
        <p>
          Place data ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-foreground underline underline-offset-4"
          >
            OpenStreetMap contributors
          </a>
          , available under the ODbL. Geocoding by{" "}
          <a
            href="https://nominatim.org/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-foreground underline underline-offset-4"
          >
            Nominatim
          </a>{" "}
          and{" "}
          <a
            href="https://photon.komoot.io/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-foreground underline underline-offset-4"
          >
            Photon
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
