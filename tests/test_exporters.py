"""Exporter tests — XLSX styling, CSV encoding, GeoJSON structure, filename safety."""

from __future__ import annotations

import codecs
import csv
import io
import json
from typing import TYPE_CHECKING

import pytest
from openpyxl import load_workbook

from app.schemas.place import Address, AmenityType, ExportFormat, Place
from app.services.exporters.base import COLUMN_HEADERS, build_filename, get_exporter

if TYPE_CHECKING:
    from collections.abc import Sequence


@pytest.fixture
def places() -> Sequence[Place]:
    return [
        Place(
            osm_id="node/1",
            name="Café Größe",  # non-ASCII, to prove the encoding survives a round trip
            amenity=AmenityType.CAFE,
            cuisine=["coffee_shop", "cake"],
            address=Address(house_number="12", street="Reeperbahn", city="Hamburg"),
            phone="+49 40 123456",
            website="https://example.com",
            opening_hours="Mo-Fr 08:00-18:00",
            latitude=53.5503,
            longitude=9.9937,
        ),
        Place(
            osm_id="way/2",
            name="Bare Minimum",
            amenity=AmenityType.FAST_FOOD,
            latitude=53.5600,
            longitude=10.0100,
        ),
    ]


class TestXlsxExporter:
    def test_produces_a_readable_workbook(self, places: Sequence[Place]) -> None:
        content = get_exporter(ExportFormat.XLSX).render(places, city_name="Hamburg")
        workbook = load_workbook(io.BytesIO(content))
        sheet = workbook["Results"]

        assert sheet.max_row == len(places) + 2  # title + header + data
        assert [cell.value for cell in sheet[2]] == list(COLUMN_HEADERS)

    def test_title_row_reports_the_count(self, places: Sequence[Place]) -> None:
        content = get_exporter(ExportFormat.XLSX).render(places, city_name="Hamburg")
        sheet = load_workbook(io.BytesIO(content))["Results"]
        assert sheet["A1"].value == "Cafes & Restaurants — Hamburg   (2 results)"

    def test_preserves_the_original_styling(self, places: Sequence[Place]) -> None:
        """Downloads must stay interchangeable with the CLI's spreadsheets."""
        content = get_exporter(ExportFormat.XLSX).render(places, city_name="Hamburg")
        sheet = load_workbook(io.BytesIO(content))["Results"]

        assert sheet["A1"].fill.fgColor.rgb == "0000D4AA"
        assert sheet["A2"].fill.fgColor.rgb == "001A1A2E"
        assert sheet["A2"].font.bold is True
        assert sheet.freeze_panes == "A3"
        assert sheet.auto_filter.ref == "A2:J4"

    def test_maps_column_is_a_hyperlink(self, places: Sequence[Place]) -> None:
        content = get_exporter(ExportFormat.XLSX).render(places, city_name="Hamburg")
        sheet = load_workbook(io.BytesIO(content))["Results"]

        cell = sheet.cell(row=3, column=10)
        assert cell.value == "📍 Open in Maps"
        assert cell.hyperlink is not None
        assert "53.5503" in str(cell.hyperlink.target)

    def test_missing_values_render_as_placeholder(self, places: Sequence[Place]) -> None:
        content = get_exporter(ExportFormat.XLSX).render(places, city_name="Hamburg")
        sheet = load_workbook(io.BytesIO(content))["Results"]

        row = {
            header: sheet.cell(row=4, column=index).value
            for index, header in enumerate(COLUMN_HEADERS, 1)
        }
        assert row["Phone"] == "N/A"
        assert row["Address"] == "N/A"
        assert row["Cuisine"] == "N/A"

    def test_formats_cuisine_for_display(self, places: Sequence[Place]) -> None:
        content = get_exporter(ExportFormat.XLSX).render(places, city_name="Hamburg")
        sheet = load_workbook(io.BytesIO(content))["Results"]
        assert sheet.cell(row=3, column=3).value == "Coffee Shop, Cake"

    def test_handles_an_empty_result_set(self) -> None:
        """No auto-filter range is valid with zero rows; the file must still open."""
        content = get_exporter(ExportFormat.XLSX).render([], city_name="Nowhere")
        sheet = load_workbook(io.BytesIO(content))["Results"]
        assert sheet.max_row == 2
        assert sheet.auto_filter.ref is None


class TestCsvExporter:
    def test_writes_header_and_rows(self, places: Sequence[Place]) -> None:
        content = get_exporter(ExportFormat.CSV).render(places, city_name="Hamburg")
        text = content.decode("utf-8-sig")
        rows = list(csv.reader(io.StringIO(text)))

        assert rows[0] == list(COLUMN_HEADERS)
        assert len(rows) == len(places) + 1

    def test_starts_with_a_utf8_bom(self, places: Sequence[Place]) -> None:
        """Without the BOM, Excel on Windows mangles non-ASCII place names."""
        content = get_exporter(ExportFormat.CSV).render(places, city_name="Hamburg")
        assert content.startswith(codecs.BOM_UTF8)

    def test_round_trips_non_ascii_names(self, places: Sequence[Place]) -> None:
        content = get_exporter(ExportFormat.CSV).render(places, city_name="Hamburg")
        rows = list(csv.reader(io.StringIO(content.decode("utf-8-sig"))))
        assert rows[1][0] == "Café Größe"

    def test_uses_crlf_line_endings(self, places: Sequence[Place]) -> None:
        content = get_exporter(ExportFormat.CSV).render(places, city_name="Hamburg")
        assert b"\r\n" in content


class TestGeoJsonExporter:
    def test_builds_a_feature_collection(self, places: Sequence[Place]) -> None:
        content = get_exporter(ExportFormat.GEOJSON).render(places, city_name="Hamburg")
        document = json.loads(content)

        assert document["type"] == "FeatureCollection"
        assert len(document["features"]) == len(places)
        assert document["metadata"]["city"] == "Hamburg"
        assert document["metadata"]["count"] == len(places)

    def test_coordinates_are_longitude_first(self, places: Sequence[Place]) -> None:
        """RFC 7946 mandates [lon, lat]; swapping them puts Hamburg in Somalia."""
        document = json.loads(
            get_exporter(ExportFormat.GEOJSON).render(places, city_name="Hamburg")
        )
        assert document["features"][0]["geometry"]["coordinates"] == [9.9937, 53.5503]

    def test_carries_properties_and_id(self, places: Sequence[Place]) -> None:
        document = json.loads(
            get_exporter(ExportFormat.GEOJSON).render(places, city_name="Hamburg")
        )
        feature = document["features"][0]
        assert feature["id"] == "node/1"
        assert feature["properties"]["name"] == "Café Größe"
        assert feature["properties"]["cuisine"] == ["coffee_shop", "cake"]


class TestBuildFilename:
    @pytest.mark.parametrize(
        ("city", "expected"),
        [
            ("Hamburg", "hamburg_cafes_restaurants.xlsx"),
            ("New York", "new_york_cafes_restaurants.xlsx"),
            ("Frankfurt am Main", "frankfurt_am_main_cafes_restaurants.xlsx"),
            ("São Paulo", "s_o_paulo_cafes_restaurants.xlsx"),
            ("../../etc/passwd", "etc_passwd_cafes_restaurants.xlsx"),
            ("!!!", "results_cafes_restaurants.xlsx"),
        ],
    )
    def test_slugifies_safely(self, city: str, expected: str) -> None:
        assert build_filename(city, "xlsx") == expected

    def test_never_contains_path_separators(self) -> None:
        name = build_filename("a/b\\c", "csv")
        assert "/" not in name
        assert "\\" not in name


class TestExporterRegistry:
    @pytest.mark.parametrize("export_format", list(ExportFormat))
    def test_every_format_is_registered(self, export_format: ExportFormat) -> None:
        exporter = get_exporter(export_format)
        assert exporter.extension == export_format.value
        assert exporter.media_type
