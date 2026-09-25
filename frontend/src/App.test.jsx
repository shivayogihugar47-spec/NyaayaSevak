import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App";
import "@testing-library/jest-dom";

describe("App Component", () => {
  test("renders NyayaCheck landing page", () => {
    render(<App />);
    const heading = screen.getByText(/NyayaCheck/i);
    expect(heading).toBeInTheDocument();
  });

  test("can open analyze document view", () => {
    render(<App />);
    const getStartedBtn = screen.getByText(/Get Started/i);
    fireEvent.click(getStartedBtn);

    // Check if the file upload section is shown
    expect(screen.getByText(/Upload Document/i)).toBeInTheDocument();
  });

  test("applies proper accessibility roles", () => {
    render(<App />);
    // Testing library's getByRole is a great way to verify accessibility
    const mainRegion = screen.getByRole("main");
    expect(mainRegion).toBeInTheDocument();
  });
});
