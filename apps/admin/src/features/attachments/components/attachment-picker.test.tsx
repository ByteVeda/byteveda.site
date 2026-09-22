import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The browser's copy of the per-file check.
 *
 * `process.env` does not exist in a bundle, so a ceiling raised with
 * `ADMIN_MAX_ATTACHMENT_BYTES` can only reach the picker as a prop — and a
 * picker that then checks against the default refuses, before the request is
 * even made, a file the upload route would have taken.
 *
 * This suite has no DOM, so the component is called as a function with the
 * three hooks it holds stubbed, and the change handler is invoked the way the
 * file dialog invokes it. That is the same code path a click takes.
 */

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useId: () => "picker",
    useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => [initial, () => {}],
  };
});

// Removing is a server action, which is neither loadable here nor under test.
vi.mock("../actions", () => ({ removeAttachment: vi.fn() }));

const { AttachmentPicker } = await import("./attachment-picker");

type PickerProps = Parameters<typeof AttachmentPicker>[0];

const MB = 1024 * 1024;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    json: async () => ({
      ok: true,
      file: { id: "f1", filename: "video.mp4", contentType: "video/mp4", byteSize: 20 * MB },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

/** A file of a given size without allocating one. Only name and size are read. */
function chosen(name: string, size: number): File {
  const file = new File([], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** The first element of a given tag in a returned tree. */
function findByTag(node: unknown, tag: string): { props: Record<string, unknown> } | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTag(child, tag);
      if (found) return found;
    }
    return null;
  }

  if (!node || typeof node !== "object") return null;
  const element = node as { type?: unknown; props?: { children?: unknown } };
  if (element.type === tag) return element as { props: Record<string, unknown> };

  return findByTag(element.props?.children, tag);
}

function pick(props: Partial<PickerProps>, file: File) {
  const input = findByTag(
    AttachmentPicker({
      kind: "broadcast",
      owner: "draft-1",
      files: [],
      onChange: () => {},
      maxFileBytes: 4 * MB,
      ...props,
    }),
    "input",
  );

  if (!input) throw new Error("the picker rendered no file input");

  const onChange = input.props.onChange as (event: unknown) => void;
  onChange({ target: { files: [file], value: "" } });
}

/** Lets the upload's promise chain settle; the refusal never starts one. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("AttachmentPicker", () => {
  it("uploads a file the deployment's raised ceiling allows", async () => {
    const onChange = vi.fn();

    pick({ maxFileBytes: 25 * MB, onChange }, chosen("video.mp4", 20 * MB));
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: "f1" })]);
  });

  it("refuses a file over the ceiling it was given, without uploading it", async () => {
    const onChange = vi.fn();

    pick({ maxFileBytes: 4 * MB, onChange }, chosen("video.mp4", 20 * MB));
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
