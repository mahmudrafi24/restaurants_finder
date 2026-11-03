const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  selectableCitySuggestions,
  shouldSubmitCityOnEnter,
} = require("../src/lib/city-suggestions.ts");
const suggestions = [{ name: "Hamburg", latitude: 53.55, longitude: 10 }];
const base = { value: "Hamburg", query: "Hamburg", suggestions, isFetching: false, isError: false };

test("previous query suggestions cannot be selected during the debounce", () => {
  assert.deepEqual(selectableCitySuggestions({ ...base, value: "Berlin" }), []);
});
test("loading and failed suggestions cannot be selected", () => {
  assert.deepEqual(selectableCitySuggestions({ ...base, isFetching: true }), []);
  assert.deepEqual(selectableCitySuggestions({ ...base, isError: true }), []);
});
test("settled current-query suggestions are selectable", () => {
  assert.deepEqual(selectableCitySuggestions(base), suggestions);
});
test("Enter submits a typed name when there are no results or the list is closed", () => {
  assert.equal(
    shouldSubmitCityOnEnter({
      key: "Enter",
      isComposing: false,
      showList: true,
      suggestionCount: 0,
    }),
    true,
  );
  assert.equal(
    shouldSubmitCityOnEnter({
      key: "Enter",
      isComposing: false,
      showList: false,
      suggestionCount: 1,
    }),
    true,
  );
});
test("Enter preserves suggestion selection and IME composition", () => {
  assert.equal(
    shouldSubmitCityOnEnter({
      key: "Enter",
      isComposing: false,
      showList: true,
      suggestionCount: 1,
    }),
    false,
  );
  assert.equal(
    shouldSubmitCityOnEnter({
      key: "Enter",
      isComposing: true,
      showList: true,
      suggestionCount: 0,
    }),
    false,
  );
  assert.equal(
    shouldSubmitCityOnEnter({
      key: "Escape",
      isComposing: false,
      showList: false,
      suggestionCount: 0,
    }),
    false,
  );
});
