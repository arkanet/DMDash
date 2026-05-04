import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NodeStatusMessage } from "./NodeStatusMessage.tsx";

describe("NodeStatusMessage", () => {
  it("renders nothing when the status is blank", () => {
    const { container } = render(
      <NodeStatusMessage status="   " title="Status Message" variant="popup" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders popup status with separators when present", () => {
    render(<NodeStatusMessage status="Battery low" title="Status Message" variant="popup" />);

    expect(screen.getByText("Status Message")).toBeInTheDocument();
    expect(screen.getByText("Battery low")).toBeInTheDocument();
    expect(screen.getAllByRole("none")).toHaveLength(2);
  });

  it("renders dialog status as a standalone card", () => {
    render(
      <NodeStatusMessage status="Going to the farm" title="Status Message" variant="dialog" />,
    );

    expect(screen.getByText("Status Message")).toBeInTheDocument();
    expect(screen.getByText("Going to the farm")).toBeInTheDocument();
  });
});
