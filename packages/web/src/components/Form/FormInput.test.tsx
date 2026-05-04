import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { GenericInput, type InputFieldProps } from "./FormInput.tsx";

type CoordinateFormValues = {
  coordinate: string | number;
};

const coordinateField: InputFieldProps<CoordinateFormValues> = {
  type: "text",
  name: "coordinate",
  label: "Coordinate",
  properties: {
    inputMode: "decimal",
    lang: "en",
    pattern: "^-?\\d+(\\.\\d{0,7})?$",
    normalizeDecimalSeparator: true,
  },
};

const CoordinateInputHarness = ({ defaultValue }: { defaultValue: string | number }) => {
  const methods = useForm<CoordinateFormValues>({
    defaultValues: {
      coordinate: defaultValue,
    },
  });

  return <GenericInput control={methods.control} field={coordinateField} />;
};

describe("GenericInput", () => {
  it("renders decimal values with a dot separator", () => {
    render(<CoordinateInputHarness defaultValue={45.1234567} />);

    expect(screen.getByRole("textbox")).toHaveValue("45.1234567");
  });

  it("normalizes typed commas to dots", async () => {
    render(<CoordinateInputHarness defaultValue="" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "45,1234567" } });

    await waitFor(() => {
      expect(input).toHaveValue("45.1234567");
    });
  });
});
