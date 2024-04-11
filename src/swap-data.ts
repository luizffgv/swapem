import { z } from "zod";

/** Schema for a leaf node in a {@link SwapData} tree. */
const DataLeafNode = z.string();
/** A leaf node in a {@link SwapData} tree. */
export type DataLeafNode = z.infer<typeof DataLeafNode>;

/** A non-root node in a {@link SwapData} tree. */
export type DataNode =
  | { [key: string]: DataNode | DataLeafNode }
  | DataLeafNode;
/** Schema for a non-root node in a {@link SwapData} tree. */
const DataNode: z.ZodType<DataNode> = z.union([
  DataLeafNode,
  z.record(z.lazy(() => DataNode)),
]);

/** Schema for the root node in a {@link SwapData} tree. */
export const DataRootNode = z.record(DataNode);
/** The root node in a {@link SwapData} tree. */
export type DataRootNode = z.infer<typeof DataRootNode>;

/** Schema for a tree that defines swap data for the text processor. */
export const SwapData = DataRootNode;
/** A tree that defines swap data for the text processor. */
export type SwapData = z.infer<typeof SwapData>;
