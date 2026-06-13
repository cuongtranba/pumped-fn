import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { atom, createScope, preset } from "@pumped-fn/lite";
import {
  ExecutionContextProvider,
  ScopeProvider,
  scopedValue,
  useScopedValue,
} from "../src";
import type { ScopedValue } from "../src";

// ─── Contract (owned by TodoList) ──────────────────────────────────────────────
//
// TodoList declares what it needs — state shape and action signatures.
// Consumers must implement this contract to pass in.
// The component does not care about internal deps or what a repo is.

type TodoItem = { id: string; text: string; done: boolean };
type Filter = "all" | "done" | "pending";

type TodoListState = {
  items: TodoItem[];
  filter: Filter;
  adding: boolean;
  error: string | null;
};

type TodoListActions = {
  add(text: string): Promise<void>;
  toggle(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  setFilter(filter: Filter): void;
};

// ─── Component ─────────────────────────────────────────────────────────────────
//
// WHAT: accepts ScopedValue<TodoListState, TodoListActions> as a prop.
//   ScopedValue is a type alias for Lite.Resource<ScopedValueAccess<State, Actions>>.
//   When useScopedValue(sv) runs, it resolves the resource in the current ExecutionContext.
//
// WHY prop instead of a direct import:
//   If the component imported a specific todoList, it would be locked to one implementation.
//   With a prop, consumers can swap the implementation at any time:
//     - test: synchronous fake repo
//     - storybook: simulated delay
//     - production: real HTTP
//   The component code never changes.

interface TodoListProps {
  sv: ScopedValue<TodoListState, TodoListActions>;
}

function TodoList({ sv }: TodoListProps) {
  const list = useScopedValue(sv);
  const { snapshot, actions } = list;

  const visible =
    snapshot.filter === "all"
      ? snapshot.items
      : snapshot.items.filter((i) =>
          snapshot.filter === "done" ? i.done : !i.done
        );

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "text"
          ) as HTMLInputElement;
          void actions.add(input.value).then(() => {
            input.value = "";
          });
        }}
      >
        <input name="text" placeholder="New todo" />
        <button type="submit" disabled={snapshot.adding}>
          {snapshot.adding ? "Adding…" : "Add"}
        </button>
      </form>

      {snapshot.error && <p role="alert">{snapshot.error}</p>}

      <div role="radiogroup" aria-label="filter">
        {(["all", "pending", "done"] as const).map((f) => (
          <button
            key={f}
            aria-pressed={snapshot.filter === f}
            onClick={() => actions.setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <ul>
        {visible.map((item) => (
          <li key={item.id} data-testid={`item-${item.id}`}>
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => void actions.toggle(item.id)}
              aria-label={item.text}
            />
            {item.text}
            <button onClick={() => void actions.remove(item.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Consumer implementation ────────────────────────────────────────────────────
//
// This is what the consumer writes — the component never sees this code.
// The consumer decides what deps to use and what logic lives inside actions.
// Only requirement: satisfy the contract ScopedValue<TodoListState, TodoListActions>.

interface TodoRepo {
  add(text: string): Promise<TodoItem>;
  remove(id: string): Promise<string>;
  toggle(id: string): Promise<string>;
}

// injectable dep — swappable via scope preset
const todoRepo = atom({
  factory: (): TodoRepo => ({
    add: async (text) => ({ id: crypto.randomUUID(), text, done: false }),
    remove: async (id) => id,
    toggle: async (id) => id,
  }),
});

// contract implementation — written by the consumer
const todoListImpl: ScopedValue<TodoListState, TodoListActions> = scopedValue({
  name: "todo-list",
  deps: { repo: todoRepo },

  initial: (): TodoListState => ({
    items: [],
    filter: "all",
    adding: false,
    error: null,
  }),

  // actions must return TodoListActions — TypeScript enforces this here
  actions: ({ get, patch }, { repo }): TodoListActions => ({
    async add(text) {
      if (!text.trim()) {
        patch({ error: "Text cannot be empty" });
        return;
      }
      patch({ adding: true, error: null });
      try {
        const item = await repo.add(text.trim());
        patch({ adding: false, items: [...get().items, item] });
      } catch (err) {
        patch({
          adding: false,
          error: err instanceof Error ? err.message : "Failed to add",
        });
      }
    },

    async toggle(id) {
      patch({
        items: get().items.map((i) =>
          i.id === id ? { ...i, done: !i.done } : i
        ),
      });
      await repo.toggle(id);
    },

    async remove(id) {
      patch({ items: get().items.filter((i) => i.id !== id) });
      await repo.remove(id);
    },

    setFilter(filter) {
      patch({ filter });
    },
  }),
});

// ─── Render helper ─────────────────────────────────────────────────────────────

function renderWithImpl(
  sv: ScopedValue<TodoListState, TodoListActions>,
  scope = createScope()
) {
  const ctx = scope.createContext();
  render(
    <ScopeProvider scope={scope}>
      <ExecutionContextProvider ctx={ctx}>
        <Suspense fallback={<p>loading</p>}>
          <TodoList sv={sv} />
        </Suspense>
      </ExecutionContextProvider>
    </ScopeProvider>
  );
  return { scope, ctx };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("TodoList with contract prop", () => {
  it("consumer injects implementation via prop — real repo", async () => {
    const { ctx } = renderWithImpl(todoListImpl);

    await screen.findByPlaceholderText("New todo");

    fireEvent.change(screen.getByPlaceholderText("New todo"), {
      target: { value: "Buy milk" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /add/i }).closest("form")!
    );

    await waitFor(() => {
      expect(screen.getByText("Buy milk")).toBeInTheDocument();
    });

    await ctx.close();
  });

  it("consumer injects a different implementation — in-memory, no repo atom needed", async () => {
    // A completely different implementation: no atom dep, stores items directly in closure.
    // The component still receives the correct contract and knows nothing about the change.
    const inMemoryImpl: ScopedValue<TodoListState, TodoListActions> =
      scopedValue({
        initial: (): TodoListState => ({
          items: [{ id: "seed-1", text: "Seeded item", done: false }],
          filter: "all",
          adding: false,
          error: null,
        }),
        actions: ({ get, patch }): TodoListActions => ({
          async add(text) {
            if (!text.trim()) {
              patch({ error: "Text cannot be empty" });
              return;
            }
            const item: TodoItem = {
              id: `local-${Date.now()}`,
              text,
              done: false,
            };
            patch({ items: [...get().items, item] });
          },
          async toggle(id) {
            patch({
              items: get().items.map((i) =>
                i.id === id ? { ...i, done: !i.done } : i
              ),
            });
          },
          async remove(id) {
            patch({ items: get().items.filter((i) => i.id !== id) });
          },
          setFilter(filter) {
            patch({ filter });
          },
        }),
      });

    const { ctx } = renderWithImpl(inMemoryImpl);

    // seeded item present from initial state
    await screen.findByText("Seeded item");

    fireEvent.change(screen.getByPlaceholderText("New todo"), {
      target: { value: "New item" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /add/i }).closest("form")!
    );

    await waitFor(() => {
      expect(screen.getByText("New item")).toBeInTheDocument();
    });

    await ctx.close();
  });

  it("consumer can still use preset to swap the repo inside the implementation", async () => {
    const mockAdd = vi
      .fn()
      .mockResolvedValue({ id: "mock-1", text: "Mocked", done: false });

    const scope = createScope({
      presets: [
        preset(todoRepo, {
          add: mockAdd,
          remove: vi.fn().mockResolvedValue("mock-1"),
          toggle: vi.fn().mockResolvedValue("mock-1"),
        }),
      ],
    });

    const { ctx } = renderWithImpl(todoListImpl, scope);
    await screen.findByPlaceholderText("New todo");

    fireEvent.change(screen.getByPlaceholderText("New todo"), {
      target: { value: "anything" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /add/i }).closest("form")!
    );

    await waitFor(() => expect(screen.getByText("Mocked")).toBeInTheDocument());

    expect(mockAdd).toHaveBeenCalledWith("anything");
    await ctx.close();
  });

  it("validation: empty add does not call repo", async () => {
    const mockAdd = vi.fn();
    const scope = createScope({
      presets: [
        preset(todoRepo, { add: mockAdd, remove: vi.fn(), toggle: vi.fn() }),
      ],
    });

    const { ctx } = renderWithImpl(todoListImpl, scope);
    await screen.findByPlaceholderText("New todo");

    fireEvent.submit(
      screen.getByRole("button", { name: /add/i }).closest("form")!
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Text cannot be empty"
      );
    });

    expect(mockAdd).not.toHaveBeenCalled();
    await ctx.close();
  });

  it("filter is pure local state — independent of the repo", async () => {
    const { ctx } = renderWithImpl(todoListImpl);
    await screen.findByPlaceholderText("New todo");

    const list = await todoListImpl.resolve(ctx);
    list.set({
      items: [
        { id: "1", text: "Done task", done: true },
        { id: "2", text: "Pending task", done: false },
      ],
      filter: "all",
      adding: false,
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Done task")).toBeInTheDocument();
      expect(screen.getByText("Pending task")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "done" }));

    await waitFor(() => {
      expect(screen.getByText("Done task")).toBeInTheDocument();
      expect(screen.queryByText("Pending task")).not.toBeInTheDocument();
    });

    await ctx.close();
  });

  it("lifecycle: store is disposed when ctx closes", async () => {
    const scope = createScope();
    const ctx = scope.createContext();
    const list = await todoListImpl.resolve(ctx);

    expect(list.disposed).toBe(false);
    await ctx.close();
    expect(list.disposed).toBe(true);

    await scope.dispose();
  });
});
