import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { useSyncFormValues } from "./DynamicForm.tsx";

type SyncFormValues = {
  name: string;
  revision?: bigint;
};

const SyncFormHarness = ({ values }: { values: SyncFormValues }) => {
  const methods = useForm<SyncFormValues>({
    defaultValues: values,
    mode: "onChange",
  });

  useSyncFormValues(methods, values);

  return <input aria-label="name" {...methods.register("name")} />;
};

const SyncFormHarnessWithControls = () => {
  const [values, setValues] = useState<SyncFormValues>({ name: "alpha" });

  return (
    <div>
      <button type="button" onClick={() => setValues({ name: "server-update" })}>
        refresh
      </button>
      <SyncFormHarness values={values} />
    </div>
  );
};

describe("useSyncFormValues", () => {
  it("applies external values while the form is pristine", async () => {
    render(<SyncFormHarnessWithControls />);

    const input = screen.getByLabelText("name") as HTMLInputElement;
    expect(input.value).toBe("alpha");

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(input.value).toBe("server-update");
    });
  });

  it("preserves dirty field values when external values change", async () => {
    render(<SyncFormHarnessWithControls />);

    const input = screen.getByLabelText("name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "local-edit" } });

    await waitFor(() => {
      expect(input.value).toBe("local-edit");
    });

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(input.value).toBe("local-edit");
    });
  });

  it("syncs form values when external state contains bigint fields", async () => {
    const BigIntSyncHarness = () => {
      const [values, setValues] = useState<SyncFormValues>({ name: "alpha", revision: 1n });

      return (
        <div>
          <button type="button" onClick={() => setValues({ name: "server-update", revision: 2n })}>
            refresh
          </button>
          <SyncFormHarness values={values} />
        </div>
      );
    };

    render(<BigIntSyncHarness />);

    const input = screen.getByLabelText("name") as HTMLInputElement;
    expect(input.value).toBe("alpha");

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(input.value).toBe("server-update");
    });
  });
});
