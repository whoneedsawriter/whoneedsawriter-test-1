import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Text,
  Flex,
  Container,
  Heading,
  VStack,
  Input,
  Switch,
} from "@chakra-ui/react";
import {
  TbArrowBack,
  TbArrowDown,
  TbArrowUp,
  TbDots,
  TbPencil,
  TbEye,
  TbTrash,
} from "react-icons/tb";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { GodmodeArticles } from "@prisma/client";
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
  DropdownMenuCheckboxItem,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { FaS } from "react-icons/fa6";
import DashboardHeader from "@/components/organisms/DashboardHeader/DashboardHeader";

type BatchData = {
  id: string;
  name: string;
  articles: number;
  completed_articles: number;
  pending_articles: number;
  failed_articles: number;
  status: number;
  articleType: string;
  createdAt: Date;
  updatedAt: Date;
};

const Batch: React.FC = () => {
  const router = useRouter();

  const {
    data: batchData,
    isLoading,
    error,
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

  //console.log(batchData); 

  const batch = batchData?.batch || [];

  const columnHelper = createColumnHelper<BatchData>();
  const columns = [
    columnHelper.accessor("id", {
      cell: ({ row }) => (
        <Text size="sm" border="none">
          <a href={`/articles?batchId=${row.original.id}`}>{row.original.name}</a>
        </Text>
      ),
      header: "Batch",
    }),
    // {
    //   id: "articleType",
    //   header: "Article Type",
    //   cell: ({ row }: { row: Row<BatchData> }) => {
    //     const formatArticleType = (type: string) => {
    //       if (type === 'godmode') return 'God Mode';
    //       if (type === 'liteMode') return 'Lite Mode';
    //       return type || 'N/A';
    //     };
        
    //     return (
    //       <div className="capitalize">
    //         {formatArticleType(row.original.articleType)}
    //       </div>
    //     );
    //   },
    // },
    {
      id: "completed",
      header: "Articles Generated",
      cell: ({ row }: { row: Row<BatchData> }) => (
        <div>{row.original.articles}</div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }: { row: Row<BatchData> }) => {
        // console.log('Row data:', {
        //   completed: row.original.completed_articles,
        //   total: row.original.articles,
        //   name: row.original.name
        // });
        
        const status = row.original.status === 0 
          ? "In progress"
          : row.original.completed_articles >= row.original.articles 
            ? "Completed" 
            : row.original.completed_articles === 0 
              ? "Failed"
              : "Partially completed";
        
        const statusColor = status === "Completed" 
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
      accessorKey: "updatedAt",
      header: ({ column }: { column: Column<any> }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
        
        const formattedDate = diffInHours <= 24
          ? formatDistanceToNow(date, { addSuffix: true }).replace('about ', '')
          : format(date, 'MM/dd/yyyy');
        
        return (
          <div className="lowercase">
            {formattedDate}
          </div>
        );
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
              <DropdownMenuItem onClick={() => router.push(`/articles?batchId=${row.original.id}`)}>
                <TbEye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDeleteDialog(row.original)}>
                <TbTrash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data: batch,
    columns: columns as ColumnDef<BatchData>[],
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableSortingRemoval: true,
    initialState: {
      pagination: {
        pageIndex: 0, //custom initial page index
        pageSize: 5, //custom default page size
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [todoToDelete, setTodoToDelete] = React.useState<BatchData | null>(null);

  const openDeleteDialog = (todo: BatchData) => {
    setTodoToDelete(todo);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setTodoToDelete(null);
    setIsDeleteDialogOpen(false);
  };

 // if (isLoading) return <Text>Loading articles...</Text>;
  if (error) return <Text>An error occurred: {error.message}</Text>;

  return (
    <Flex justifyContent="flex-start" w="100%" minH="100vh">
        <div className="flex-col w-full">
      <DashboardHeader /> 
      <Container px="27px" pt={["15px", "15px", "96px"]} alignItems="flex-center" maxWidth="1050px" mb="56px">
      <VStack align="flex-start" spacing={4}>
        <Heading size="md">Batches Generated</Heading>
        <Text 
          as="a"
          href="https://whoneedsawriter.com/articles"
          target="_blank"
          rel="noopener noreferrer"
          color="blue.500"
          textDecoration="underline"
          _hover={{ textDecoration: "underline" }}
          cursor="pointer">
          View all Articles
        </Text>
        <Text className="text-slate-500 text-sm">
          Here is a list of articles generated from the tool.
        </Text>
        <Button 
           colorScheme="brand" 
           onClick={() => router.push('/article-generator')}>
          Generate New articles
        </Button>
        <div className="w-full">
          <Table className="rounded-md border  w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="text-center">
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-center">
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
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {isLoading ? 'Loading...' : 'No results.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </VStack>
      <DeleteTodoDialog
        todo={todoToDelete || undefined}
        isOpen={isDeleteDialogOpen}
          onClose={closeDeleteDialog}
        />
      </Container>
    </div>
    </Flex>
  );
};

export default Batch;

const DeleteTodoDialog = ({
  todo,
  isOpen,
  onClose,
}: {
  todo: BatchData | undefined;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const deleteTodoMutation = useMutation({
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
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
            <br />
            This will permanently delete the batch <strong>{todo?.name}</strong> and all its articles.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              deleteTodoMutation.mutate(todo?.id || "");
            }}
            disabled={deleteTodoMutation.isPending}
          >
            {deleteTodoMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};