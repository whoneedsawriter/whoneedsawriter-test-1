"use client";

import React from "react";
import {
  Button,
  Text,
  Flex,
  Container,
  Heading,
  VStack,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  List,
  ListItem,
} from "@chakra-ui/react";
import {
  TbArrowDown,
  TbArrowUp,
  TbDots,
  TbEye,
  TbTrash,
} from "react-icons/tb";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient } from "@/app/providers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow, format } from "date-fns";
import DashboardHeader from "@/components/organisms/DashboardHeader/DashboardHeader";
import { useRouter } from "next/navigation";

type BatchData = {
  id: string;
  name: string;
  articles: number;
  completed_articles: number;
  pending_articles: number;
  failed_articles: number;
  status: number;
  articleType: string;
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type KeywordRecord = {
  id: string;
  website_url: string | null;
  description: string | null;
  seedKeyword: string | null;
  goal: string | null;
  json: string | null;
  status: number;
  createdAt: string;
};

function getKeywordsFromJson(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      if (Array.isArray(o.keywords)) {
        return o.keywords.filter((x): x is string => typeof x === "string");
      }
      if (Array.isArray(o.data)) {
        return o.data.filter((x): x is string => typeof x === "string");
      }
    }
  } catch {
    // ignore
  }
  return [];
}

type ViewKeywordsModalProps = {
  record: KeywordRecord | null;
  isOpen: boolean;
  onClose: () => void;
};

const ViewKeywordsModal: React.FC<ViewKeywordsModalProps> = ({
  record,
  isOpen,
  onClose,
}) => {
  const keywords = React.useMemo(
    () => getKeywordsFromJson(record?.json ?? null),
    [record?.json]
  );
  const topicLabel = record
    ? record.seedKeyword || record.website_url || "—"
    : "—";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Keywords</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Text fontSize="sm" color="gray.600" mb={3}>
            Topic: <strong>{topicLabel}</strong>
          </Text>
          {keywords.length === 0 ? (
            <Text color="gray.500">No keywords to display.</Text>
          ) : (
            <List spacing={2} maxH="400px" overflowY="auto">
              {keywords.map((kw, i) => (
                <ListItem key={i} display="flex" alignItems="center" gap={2}>
                  <Box w="6px" h="6px" borderRadius="full" bg="gray.400" flexShrink={0} />
                  <Text fontSize="sm">{kw}</Text>
                </ListItem>
              ))}
            </List>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

type DeleteKeywordDialogProps = {
  record: KeywordRecord | undefined;
  isOpen: boolean;
  onClose: () => void;
};

const DeleteKeywordDialog: React.FC<DeleteKeywordDialogProps> = ({
  record,
  isOpen,
  onClose,
}) => {
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/keyword-research/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Topic deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["keyword-history"] });
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error deleting topic");
    },
  });

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete topic?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this keyword generation and its data.
            Topic: <strong>{record?.seedKeyword || record?.website_url || "—"}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (record?.id) deleteMutation.mutate(record.id);
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const GenerationHistory: React.FC = () => {
  const router = useRouter();

  // Article batches
  const {
    data: batchData,
    isLoading: isLoadingBatches,
    error: batchError,
  } = useQuery({
    queryKey: ["batch"],
    queryFn: async () => {
      const response = await fetch("/api/article-generator/batch");
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    },
    enabled: true,
  });

  const batches: BatchData[] = batchData?.batch || [];

  const batchColumnHelper = createColumnHelper<BatchData>();
  const batchColumns = [
    batchColumnHelper.accessor("name", {
      cell: ({ row }) => (
        <Text size="sm" border="none">
          <a href={`/articles?batchId=${row.original.id}`}>{row.original.name}</a>
        </Text>
      ),
      header: "Batch",
    }),
    {
      id: "articleType",
      header: "Article Type",
      cell: ({ row }: { row: Row<BatchData> }) => {
        const displayValue = row.original.model || row.original.articleType;

        const formatArticleType = (type: string | null) => {
          if (!type) return "N/A";
          if (type === "godmode") return "God Mode";
          if (type === "liteMode") return "Lite Mode";

          return type
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
        };

        return <div>{formatArticleType(displayValue)}</div>;
      },
    },
    {
      id: "articles",
      header: "Articles Generated",
      cell: ({ row }: { row: Row<BatchData> }) => (
        <div>{row.original.articles}</div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }: { row: Row<BatchData> }) => {
        const status =
          row.original.status === 0
            ? "In progress"
            : row.original.completed_articles >= row.original.articles
            ? "Completed"
            : row.original.completed_articles === 0
            ? "Failed"
            : "Partially completed";

        const statusColor =
          status === "Completed"
            ? "green.500"
            : status === "Partially completed"
            ? "orange.500"
            : status === "In progress"
            ? "blue.500"
            : "red.500";

        return (
          <Text color={statusColor} fontWeight="medium">
            {status}
          </Text>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }: { column: Column<any> }) => {
        return (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            size="sm"
          >
            Created
            {column.getIsSorted() === "desc" && (
              <TbArrowDown className="ml-2 h-4 w-4" />
            )}
            {column.getIsSorted() === "asc" && (
              <TbArrowUp className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row }: { row: Row<BatchData> }) => {
        const date = new Date(row.original.createdAt);
        const now = new Date();
        const diffInHours =
          (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        const formattedDate =
          diffInHours <= 24
            ? formatDistanceToNow(date, { addSuffix: true }).replace(
                "about ",
                ""
              )
            : format(date, "MM/dd/yyyy");

        return <div className="lowercase">{formattedDate}</div>;
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }: { row: Row<BatchData> }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <TbDots className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/articles?batchId=${row.original.id}`)
                }
              >
                View Articles
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openDeleteDialog(row.original)}
              >
                Delete Batch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const [batchSorting, setBatchSorting] = React.useState<SortingState>([]);
  const [batchColumnFilters, setBatchColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [batchColumnVisibility, setBatchColumnVisibility] =
    React.useState<VisibilityState>({});
  const [batchRowSelection, setBatchRowSelection] = React.useState({});

  const batchTable = useReactTable({
    data: batches,
    columns: batchColumns as ColumnDef<BatchData>[],
    onSortingChange: setBatchSorting,
    onColumnFiltersChange: setBatchColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setBatchColumnVisibility,
    onRowSelectionChange: setBatchRowSelection,
    enableSortingRemoval: true,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    },
    state: {
      sorting: batchSorting,
      columnFilters: batchColumnFilters,
      columnVisibility: batchColumnVisibility,
      rowSelection: batchRowSelection,
    },
  });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [batchToDelete, setBatchToDelete] = React.useState<BatchData | null>(
    null
  );

  const openDeleteDialog = (batch: BatchData) => {
    setBatchToDelete(batch);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setBatchToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  // Keyword generations
  const {
    data: keywordData,
    isLoading: isLoadingKeywords,
    error: keywordError,
  } = useQuery({
    queryKey: ["keyword-history"],
    queryFn: async () => {
      const response = await fetch("/api/keyword-research/history");
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json() as Promise<{ keywords: KeywordRecord[] }>;
    },
  });

  const keywords: KeywordRecord[] = keywordData?.keywords || [];

  const keywordColumnHelper = createColumnHelper<KeywordRecord>();
  const keywordColumns = [
    keywordColumnHelper.accessor("id", {
      cell: ({ row }) => (
        <Text size="sm" border="none">
          {row.original.id}
        </Text>
      ),
      header: "Generation ID",
    }),
    {
      id: "topic",
      header: "Topic",
      cell: ({ row }: { row: Row<KeywordRecord> }) => {
        const topic = row.original.seedKeyword || row.original.website_url;
        return <Text>{topic || "-"}</Text>;
      },
    },
    {
      id: "keywordsGenerated",
      header: "Keywords Generated",
      cell: ({ row }: { row: Row<KeywordRecord> }) => {
        const { json } = row.original;
        let count = 0;

        if (json) {
          try {
            const parsed: any = JSON.parse(json);
            if (Array.isArray(parsed)) {
              count = parsed.length;
            } else if (Array.isArray(parsed?.keywords)) {
              count = parsed.keywords.length;
            } else if (Array.isArray(parsed?.data)) {
              count = parsed.data.length;
            }
          } catch {
            count = 0;
          }
        }

        return <Text>{count > 0 ? count : "-"}</Text>;
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }: { row: Row<KeywordRecord> }) => {
        const statusCode = row.original.status;
        const statusLabel =
          statusCode === 1
            ? "Completed"
            : statusCode === 2
            ? "Failed"
            : "In progress";
        const color =
          statusCode === 1
            ? "green.500"
            : statusCode === 2
            ? "red.500"
            : "blue.500";
        return (
          <Text color={color} fontWeight="medium">
            {statusLabel}
          </Text>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }: { row: Row<KeywordRecord> }) => {
        const record = row.original;
        const hasKeywords = !!record.json;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <TbDots className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/keyword-details?id=${record.id}`)
                }
                disabled={!hasKeywords}
              >
                <TbEye className="mr-2 h-4 w-4" />
                View Keywords
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setKeywordToDelete(record)}
                className="text-destructive focus:text-destructive"
              >
                <TbTrash className="mr-2 h-4 w-4" />
                Delete topic
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const [keywordSorting, setKeywordSorting] = React.useState<SortingState>(
    []
  );
  const [keywordColumnFilters, setKeywordColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [keywordColumnVisibility, setKeywordColumnVisibility] =
    React.useState<VisibilityState>({});
  const [keywordRowSelection, setKeywordRowSelection] = React.useState({});

  const [viewKeywordsRecord, setViewKeywordsRecord] =
    React.useState<KeywordRecord | null>(null);
  const [keywordToDelete, setKeywordToDelete] =
    React.useState<KeywordRecord | null>(null);

  const keywordTable = useReactTable({
    data: keywords,
    columns: keywordColumns as ColumnDef<KeywordRecord>[],
    onSortingChange: setKeywordSorting,
    onColumnFiltersChange: setKeywordColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setKeywordColumnVisibility,
    onRowSelectionChange: setKeywordRowSelection,
    enableSortingRemoval: true,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    },
    state: {
      sorting: keywordSorting,
      columnFilters: keywordColumnFilters,
      columnVisibility: keywordColumnVisibility,
      rowSelection: keywordRowSelection,
    },
  });

  return (
    <Flex justifyContent="flex-start" w="100%" minH="100vh">
      <div className="flex-col w-full">
        <DashboardHeader />
        <Container
          px="27px"
          pt={["15px", "15px", "96px"]}
          alignItems="flex-center"
          maxWidth="1050px"
          mb="56px"
        >
          <VStack align="flex-start" spacing={4} w="100%">
            <Heading size="md">Generation History</Heading>
            <Text className="text-slate-500 text-sm">
              Review your article batches and keyword generations.
            </Text>

            <Tabs variant="enclosed" w="100%">
              <TabList>
                <Tab>Articles</Tab>
                <Tab>Keywords</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0}>
                  {batchError && (
                    <Text color="red.500">
                      An error occurred: {batchError.message}
                    </Text>
                  )}
                  <Box className="w-full">
                    <Table className="rounded-md border  w-full">
                      <TableHeader>
                        {batchTable.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                              return (
                                <TableHead
                                  key={header.id}
                                  className="text-center"
                                >
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                </TableHead>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {batchTable.getRowModel().rows?.length ? (
                          batchTable.getRowModel().rows.map((row) => (
                            <TableRow
                              key={row.id}
                              data-state={
                                row.getIsSelected() && "selected"
                              }
                            >
                              {row.getVisibleCells().map((cell) => (
                                <TableCell
                                  key={cell.id}
                                  className="text-center"
                                >
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={batchColumns.length}
                              className="h-24 text-center"
                            >
                              {isLoadingBatches
                                ? "Loading..."
                                : "No results."}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-end space-x-2 py-4">
                      <div className="flex-1 text-sm text-muted-foreground">
                        Page {batchTable.getState().pagination.pageIndex + 1} of{" "}
                        {batchTable.getPageCount()}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => batchTable.previousPage()}
                          disabled={!batchTable.getCanPreviousPage()}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => batchTable.nextPage()}
                          disabled={!batchTable.getCanNextPage()}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </Box>
                </TabPanel>
                <TabPanel px={0}>
                  {keywordError && (
                    <Text color="red.500">
                      An error occurred: {keywordError.message}
                    </Text>
                  )}
                  <Box className="w-full">
                    <Table className="rounded-md border  w-full">
                      <TableHeader>
                        {keywordTable.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                              return (
                                <TableHead
                                  key={header.id}
                                  className="text-center"
                                >
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                </TableHead>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {keywordTable.getRowModel().rows?.length ? (
                          keywordTable.getRowModel().rows.map((row) => (
                            <TableRow
                              key={row.id}
                              data-state={
                                row.getIsSelected() && "selected"
                              }
                            >
                              {row.getVisibleCells().map((cell) => (
                                <TableCell
                                  key={cell.id}
                                  className="text-center"
                                >
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={keywordColumns.length}
                              className="h-24 text-center"
                            >
                              {isLoadingKeywords
                                ? "Loading..."
                                : "No results."}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-end space-x-2 py-4">
                      <div className="flex-1 text-sm text-muted-foreground">
                        Page{" "}
                        {keywordTable.getState().pagination.pageIndex + 1} of{" "}
                        {keywordTable.getPageCount()}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => keywordTable.previousPage()}
                          disabled={!keywordTable.getCanPreviousPage()}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => keywordTable.nextPage()}
                          disabled={!keywordTable.getCanNextPage()}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </Box>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </VStack>

          <DeleteBatchDialog
            batch={batchToDelete || undefined}
            isOpen={isDeleteDialogOpen}
            onClose={closeDeleteDialog}
          />

          <ViewKeywordsModal
            record={viewKeywordsRecord}
            isOpen={!!viewKeywordsRecord}
            onClose={() => setViewKeywordsRecord(null)}
          />
          <DeleteKeywordDialog
            record={keywordToDelete || undefined}
            isOpen={!!keywordToDelete}
            onClose={() => setKeywordToDelete(null)}
          />
        </Container>
      </div>
    </Flex>
  );
};

export default GenerationHistory;

type DeleteBatchDialogProps = {
  batch: BatchData | undefined;
  isOpen: boolean;
  onClose: () => void;
};

const DeleteBatchDialog: React.FC<DeleteBatchDialogProps> = ({
  batch,
  isOpen,
  onClose,
}) => {
  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await fetch("/api/article-generator/batch", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: batchId }),
      });
      if (!response.ok) {
        throw new Error("Failed to delete batch");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Batch deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["batch"] });
      onClose();
    },
    onError: () => {
      toast.error("Error deleting batch");
    },
  });

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
            <br />
            This will permanently delete the batch{" "}
            <strong>{batch?.name}</strong> and all its articles.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              deleteBatchMutation.mutate(batch?.id || "");
            }}
            disabled={deleteBatchMutation.isPending}
          >
            {deleteBatchMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

