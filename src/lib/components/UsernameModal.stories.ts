/* Using renderer types for Svelte; rule disabled for this line intentionally. */
// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from "@storybook/svelte";
import { within, userEvent } from "@storybook/testing-library";
import UsernameModal from "./UsernameModal.svelte";

const meta: Meta<UsernameModal> = {
  title: "Auth/UsernameModal",
  component: UsernameModal,
  parameters: {
    a11y: { disable: false },
  },
  args: {},
};

export default meta;

type Story = StoryObj<UsernameModal>;

export const Default: Story = {
  render: () => ({
    Component: UsernameModal,
    props: {},
  }),
};

export const InvalidEmptySubmit: Story = {
  render: () => ({ Component: UsernameModal, props: {} }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", {
      name: /save username/i,
    });
    await userEvent.click(button);
    await canvas.findByRole("alert");
  },
};

export const InvalidTooShort: Story = {
  render: () => ({ Component: UsernameModal, props: {} }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByPlaceholderText(/korewata/i);
    await userEvent.type(input, "ab");
    const button = await canvas.findByRole("button", {
      name: /save username/i,
    });
    await userEvent.click(button);
    await canvas.findByText(/at least/i);
  },
};

export const InvalidTooLong: Story = {
  render: () => ({ Component: UsernameModal, props: {} }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByPlaceholderText(/korewata/i);
    await userEvent.type(input, "a".repeat(25));
    const button = await canvas.findByRole("button", {
      name: /save username/i,
    });
    await userEvent.click(button);
    await canvas.findByText(/at most/i);
  },
};
