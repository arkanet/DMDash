import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { PasswordGenerator, type PasswordGeneratorProps } from "./FormPasswordGenerator.tsx";

type FormValues = {
  secret: string;
};

const baseField: PasswordGeneratorProps<FormValues> = {
  type: "passwordGenerator",
  id: "secret-input",
  name: "secret",
  label: "Secret",
  description: "Secret field",
  bits: [{ text: "256 bit", value: "32", key: "bit256" }],
  devicePSKBitCount: 32,
  actionButtons: [],
};

function PasswordGeneratorHarness({
  inputChange,
}: {
  inputChange?: React.ChangeEventHandler<HTMLInputElement>;
}) {
  const methods = useForm<FormValues>({
    defaultValues: {
      secret: "",
    },
  });

  return (
    <>
      <PasswordGenerator<FormValues>
        control={methods.control}
        field={{
          ...baseField,
          inputChange,
        }}
      />
      <output data-testid="secret-value">{methods.watch("secret")}</output>
    </>
  );
}

describe("PasswordGenerator", () => {
  it("updates the field value when text is pasted", async () => {
    const user = userEvent.setup();
    render(<PasswordGeneratorHarness />);

    await user.click(screen.getByRole("textbox"));
    await user.paste("pasted-secret");

    expect(screen.getByTestId("secret-value").textContent).toBe("pasted-secret");
  });

  it("calls the external inputChange handler on paste", async () => {
    const inputChange = vi.fn();
    const user = userEvent.setup();
    render(<PasswordGeneratorHarness inputChange={inputChange} />);

    await user.click(screen.getByRole("textbox"));
    await user.paste("pasted-secret");

    expect(inputChange).toHaveBeenCalled();
  });
});
