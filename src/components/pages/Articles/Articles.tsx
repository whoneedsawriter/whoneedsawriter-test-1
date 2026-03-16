import React, { useState, useEffect } from "react";
import {
  Button,
  Text,
  Flex,
  Container,
  Heading,
  VStack,
  Input,
  Switch,
  Link,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Checkbox,
  Spinner,
  Box,
  Radio,
  RadioGroup,
  Tooltip,
  useColorMode,
  Select,
} from "@chakra-ui/react";
import {
  TbArrowBack,
  TbArrowDown,
  TbArrowUp,
  TbDots,
  TbPencil,
  TbEye,
  TbTrash,
  TbChevronRight,
  TbQuestionMark,
} from "react-icons/tb";
import { MdPublish } from "react-icons/md";
import { FaPlus } from "react-icons/fa6";
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
import { useSearchParams, useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { BsFillQuestionCircleFill } from "react-icons/bs";
import DashboardHeader from "@/components/organisms/DashboardHeader/DashboardHeader";


interface UserWebsite {
  id: number;
  name: string;
  siteUrl: string;
  userId: string;
  checked?: boolean;
}

const ArticlesList: React.FC = () => {
  const { colorMode } = useColorMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const batch_param = searchParams.get("batchId"); 
  const [enabled, setEnabled] = useState(false);
  const [batchName, setBatchName] = useState<string | null>(null);

  // Modal states
  const { isOpen: isWebsiteSelectOpen, onOpen: onWebsiteSelectOpen, onClose: onWebsiteSelectClose } = useDisclosure();
  const { isOpen: isSetupOpen, onOpen: onSetupOpen, onClose: onSetupClose } = useDisclosure();
  const { isOpen: isPublishingSettingsOpen, onOpen: onPublishingSettingsOpen, onClose: onPublishingSettingsClose } = useDisclosure();
  const { isOpen: isUpdatePluginOpen, onOpen: onUpdatePluginOpen, onClose: onUpdatePluginClose } = useDisclosure();

  // Website and publishing states
  const [userWebsites, setUserWebsites] = useState<UserWebsite[]>([]);
  const [isLoadingWebsites, setIsLoadingWebsites] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingSettings, setPublishingSettings] = useState({
    saveOption: 'draft',
    addFeaturedImage: true,
    addMetaContent: true,
    scheduleTime: 'one_post_per_day',
  });

  // Add selected website state for single selection
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>('');

  // Add publishing progress state
  const [publishingFailedMessage, setPublishingFailedMessage] = useState<string>('');
  const [publishingProgress, setPublishingProgress] = useState<{
    current: number;
    total: number;
    currentArticle: string;
    completed: string[];
    failed: string[];
    isCompleted: boolean;
  }>({
    current: 0,
    total: 0,
    currentArticle: '',
    completed: [],
    failed: [],
    isCompleted: false
  });

  // Add new modal state for article selection
  const { isOpen: isArticleSelectOpen, onOpen: onArticleSelectOpen, onClose: onArticleSelectClose } = useDisclosure();
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  
  // Add new modal state for author selection
  const { isOpen: isAuthorSelectOpen, onOpen: onAuthorSelectOpen, onClose: onAuthorSelectClose } = useDisclosure();
  
  // Add state for managing categories for each article and common author for all articles
  const [articleCategories, setArticleCategories] = useState<{[articleId: string]: string}>({});
  const [selectedAuthor, setSelectedAuthor] = useState<number>(1);

  useEffect(() => {
    if (batch_param) {
      setEnabled(true);
      // Fetch batch name from API
      fetch(`/api/article-generator/batch-name?batchId=${batch_param}`)
        .then(res => res.json())
        .then(data => {
        //  console.log(data);
          if (data && data.name) setBatchName(data.name);
        });
    }
  }, [batch_param]);

  const {
    data: todosData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["todos", batch_param],
    queryFn: async () => {
      const url = batch_param ? `/api/article-generator?batchId=${batch_param}` : "/api/article-generator";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json() as Promise<{
        todos: (Omit<GodmodeArticles, "updatedAt"> & { updatedAt: string })[];
      }>;
    },
    enabled: true,
  });

  const updateTodoMutation = useMutation({
    mutationFn: async (updatedTodo: {
      id: string;
      text?: string;
      isCompleted?: boolean;
    }) => {
      const response = await fetch("/api/article-generator", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedTodo),
      });
      if (!response.ok) {
        throw new Error("Failed to update todo");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success("Todo updated successfully");
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
    onError: (error) => {
      toast.error("Error updating todo");
    },
  });

  const handleUpdateTodo = async (
    todo: Pick<GodmodeArticles, "id" | "content">
  ) => {
    return await updateTodoMutation.mutateAsync(todo);
  };

  const todos = todosData?.todos || [];

  const columnHelper = createColumnHelper<{
    id: string;
    keyword: string;
    status: number;
    updatedAt: string;
  }>();

  const columns = [
    columnHelper.accessor("keyword", {
      cell: ({ row }) => (
        <Text
          size="sm"
          border="none"
        ><a href={`/articles/${row.original.id}`}>{row.original.keyword}</a></Text>
      ),
      header: "Keyword",
    }),
    {
      accessorKey: "updatedAt",
      header: ({ column }: { column: Column<any> }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            size="sm"
          >
            Last update
            {column.getIsSorted() === "desc" && (
              <TbArrowDown className="ml-2 h-4 w-4" />
            )}
            {column.getIsSorted() === "asc" && (
              <TbArrowUp className="ml-2 h-4 w-4" />
            )}
          </Button>
        );
      },
      cell: ({ row }: { row: Row<GodmodeArticles> }) => {
        const date = new Date(row.original.updatedAt);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
        
        const formattedDate = diffInHours <= 24
          ? formatDistanceToNow(date, { addSuffix: true })
          : format(date, 'MM/dd/yyyy');

        return (
          <div className="lowercase">
            {formattedDate}
          </div>
        );
      },
    },
    {
      id: "status",
      enableHiding: false,
      header: 'Status',
      cell: ({ row }: { row: Row<GodmodeArticles> }) => {
        const getStatusColor = (status: number) => {
          switch (status) {
            case 1:
              return 'green.500';
            case 2:
              return 'red.500';
            default:
              return 'yellow.500';
          }
        };
        return (
          <Text color={getStatusColor(row.original.status)}>
            {row.original.status === 1 ? 'Complete' : row.original.status === 2 ? 'Failed' : 'In progress'}
          </Text>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }: { row: Row<GodmodeArticles> }) => {
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
              <DropdownMenuItem onClick={() => router.push(`/articles/${row.original.id}`)}>
                <TbEye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/articles/${row.original.id}`)}>
                <TbPencil className="mr-2 h-4 w-4" />
                Edit
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
    data: todos,
    columns: columns as ColumnDef<
      Omit<GodmodeArticles, "updatedAt"> & { updatedAt: string }
    >[],
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
        pageIndex: 0,
        pageSize: 5,
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
  const [todoToDelete, setTodoToDelete] = React.useState<GodmodeArticles | null>(null);

  const openDeleteDialog = (todo: GodmodeArticles) => {
    setTodoToDelete(todo);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setTodoToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [todoToEdit, setTodoToEdit] = React.useState<GodmodeArticles | null>(null);

  const closeEditDialog = () => {
    setTodoToEdit(null);
    setIsEditDialogOpen(false);
  };

  // Fetch user websites
  useEffect(() => {
    const fetchUserWebsites = async () => {
      try {
        const response = await fetch('/api/user-websites');
        if (!response.ok) {
          throw new Error('Failed to fetch user websites');
        }
        const websites = await response.json();
        //console.log(websites);
        setUserWebsites(websites.map((site: UserWebsite) => ({
          ...site,
          checked: false
        })));
      } catch (error) {
        console.error('Error fetching user websites:', error);
        toast.error('Failed to load WordPress sites');
      } finally {
        setIsLoadingWebsites(false);
      }
    };

    fetchUserWebsites();
  }, []);

  // Modify handlePublishClick to check userWebsites length
  const handlePublishClick = () => {
    const completedArticles = todos.filter(article => article.status === 1);
    if (completedArticles.length === 0) {
      toast.error('No completed articles available in the Batch');
      return;
    }

    if (userWebsites.length === 0) {
      onSetupOpen();
    } else {
      onWebsiteSelectOpen();
    }
  };

  // Modify handlePublish to use selectedArticles
  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      setPublishingFailedMessage('');
      
      // Get selected WordPress site
      const selectedWebsite = userWebsites.find(site => site.id.toString() === selectedWebsiteId);
      //console.log(selectedWebsite);
      
      if (!selectedWebsite) {
        toast.error('Please select a WordPress site');
        return;
      }

      const selectedSites = [selectedWebsite.siteUrl];

      // Get selected articles
      const articlesToPublish = todos.filter(article => selectedArticles.includes(article.id));

      if (articlesToPublish.length === 0) {
        toast.error('No articles selected for publishing');
        return;
      }

      // Initialize progress
      setPublishingProgress({
        current: 0,
        total: articlesToPublish.length,
        currentArticle: '',
        completed: [],
        failed: [],
        isCompleted: false
      });

      // Publish each article
      for (let i = 0; i < articlesToPublish.length; i++) {
        const article = articlesToPublish[i];
        
        // Update current article being processed
        setPublishingProgress(prev => ({
          ...prev,
          current: i + 1,
          currentArticle: article.keyword
        }));
      // Get article title from h1 tag
      const titleMatch = article.content?.match(/<h1[^>]*>(.*?)<\/h1>/);
      const title = titleMatch ? titleMatch[1] : article.keyword || '';

        // Process content - remove h1 and image after h1
        let processedContent = article.content || '';
        
        // Remove h1 tag and immediately following image if exists
        processedContent = processedContent.replace(/<h1[^>]*>(.*?)<\/h1>\s*(<div>)?<img[^>]*>(<\/div>)?/, '');
        
        // Fallback: if h1 exists without immediate image, just remove h1
        processedContent = processedContent.replace(/<h1[^>]*>(.*?)<\/h1>/, '');

        let scheduleTime = '';
        if (publishingSettings.saveOption === 'future') {
          scheduleTime = publishingSettings.scheduleTime === 'one_post_per_day' ? '+' + i*24 + ' hours' : '+' + i*7 + ' days';
        }
        
        const response = await fetch('/api/publish-to-wordpress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            wordpressSites: selectedSites,
            title: article.title || title,
            content: processedContent,
            addFeaturedImage: publishingSettings.addFeaturedImage,
            imageUrl: article.featuredImage || '',
            category: articleCategories[article.id] || 'Uncategorized',
            author: selectedAuthor || 1,
            saveOption: publishingSettings.saveOption,
            scheduleTime: scheduleTime,
            metaTitle: article.metaTitle || '',
            metaDescription: article.metaDescription || '',
            addMetaContent: publishingSettings.addMetaContent
          }),
        });

        const data = await response.json();
        setPublishingFailedMessage(data.message);

        if (response.ok) {
          // Update completed articles
          setPublishingProgress(prev => ({
            ...prev,
            completed: [...prev.completed, article.keyword]
          }));
        } else {
          // Update failed articles
          setPublishingProgress(prev => ({
            ...prev,
            failed: [...prev.failed, article.keyword]
          }));
        }
      }

      // Mark publishing as completed
      setPublishingProgress(prev => ({
        ...prev,
        isCompleted: true
      }));
      
      setSelectedArticles([]); // Reset selection after publishing
      setArticleCategories({}); // Reset categories after publishing
      setSelectedAuthor(1); // Reset author after publishing
      
    } catch (error) {
      console.error('Error publishing to WordPress:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to publish to WordPress');
    } finally {
      setIsPublishing(false);
    }
  };

  // Custom close handler for publishing settings modal
  const handlePublishingSettingsClose = () => {
    // Reset publishing state and progress when modal is closed
    setIsPublishing(false);
    setPublishingProgress({
      current: 0,
      total: 0,
      currentArticle: '',
      completed: [],
      failed: [],
      isCompleted: false
    });
    setSelectedArticles([]); // Reset article selection
    setArticleCategories({}); // Reset categories
    setSelectedAuthor(1); // Reset author
    onPublishingSettingsClose();
  };

  // Custom close handler for website selection modal
  const handleWebsiteSelectClose = () => {
    // Reset selected website when modal is closed
  //  setSelectedWebsiteId('');
    onWebsiteSelectClose();
  };

  // if (isLoading) return <Text>Loading articles...</Text>;
  if (error) return <Text>An error occurred: {error.message}</Text>;

  return (
    <Flex justifyContent="flex-start" w="100%" minH="100vh">
        <div className="flex-col w-full">
      <DashboardHeader /> 
      <Container pt={["15px", "15px", "96px"]} alignItems="flex-center" maxWidth="1050px" mb="56px">
      <VStack align="flex-start" spacing={4}>
        <div className="flex flex-col gap-3 py-2">
          <Heading size="md" fontWeight="600" fontSize="lg" className="text-slate-500">
            {batch_param ? batchName : 'My Articles'}
          </Heading>
          
          {/* Stylized Breadcrumb */}
          {batch_param && (
            <div className="flex items-center gap-2 text-sm">
              <Link 
                href="/batch" 
                className="text-blue-500 hover:text-blue-700 transition-colors font-medium"
              >
                All Batches
              </Link>
              <TbChevronRight className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600 font-medium">{batchName}</span>
            </div>
          )}
        </div>
        <Text className="text-slate-500 text-sm">
         {batch_param ? 
          'Here is a list of articles generated for this batch'
            : 
          'Here is a list of articles generated from the tool.'
         } 
        </Text>
        <Flex w="100%" justify="space-between">
          <Button 
             colorScheme="brand" 
             onClick={() => router.push('/article-generator')}>
            <span className="block sm:hidden flex items-center gap-2">
              <FaPlus size={14} />
              New articles
            </span>
            <span className="hidden sm:block">Generate New articles</span>
          </Button>
          { todosData?.todos && todosData.todos.length > 0 &&
            <Button
              colorScheme="blue"
              leftIcon={<MdPublish />}
              onClick={handlePublishClick}>
              <span className="block sm:hidden flex items-center gap-2">
                Publish
              </span>
              <span className="hidden sm:block">Publish Articles</span>
            </Button>
          }
        </Flex>
        <div className="rounded-md border  w-full">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
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
                      <TableCell key={cell.id}>
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
        </div>
        <div className="flex items-center justify-end space-x-2 py-4 w-full">
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
      </VStack>
      <DeleteTodoDialog
        todo={todoToDelete || undefined}
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
      />
      {isEditDialogOpen && (
        <EditTodoDialog
          todo={todoToEdit || undefined}
          isOpen={isEditDialogOpen}
          onClose={closeEditDialog}
          onUpdate={handleUpdateTodo}
          isLoading={updateTodoMutation.isPending}
        />
      )}

      {/* Article Selection Modal */}
      <Modal isOpen={isArticleSelectOpen} onClose={onArticleSelectClose} size="xl">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? '#060d36' : '#fff'}>
          <ModalHeader>Select Articles to Publish</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack align="stretch" spacing={4}>
              <Text fontSize="sm" color="text-slate-500" mb={4}>
              Your selected articles will be published or saved to draft on your website as per your choice along with Meta title and Descriptions.
              </Text>
              
              {todos.filter(article => article.status === 1).length === 0 ? (
                <Text color="red.500" textAlign="center" py={4}>
                  No completed articles available in the Batch
                </Text>
              ) : (
                <VStack align="stretch" spacing={3}>
                  {/* Select All Option */}
                  <Box p={3}>
                    <Checkbox
                      isChecked={selectedArticles.length === todos.filter(article => article.status === 1).length && selectedArticles.length > 0}
                      isIndeterminate={selectedArticles.length > 0 && selectedArticles.length < todos.filter(article => article.status === 1).length}
                      onChange={(e) => {
                        const completedArticles = todos.filter(article => article.status === 1);
                        if (e.target.checked) {
                          // Select all completed articles
                          setSelectedArticles(completedArticles.map(article => article.id));
                        } else {
                          // Deselect all articles
                          setSelectedArticles([]);
                          setArticleCategories({});
                        }
                      }}
                      size="md"
                      colorScheme="blue"
                    >
                      <Text fontWeight="bold" color="text-slate-500">
                        Select All Articles
                      </Text>
                    </Checkbox>
                  </Box>
                  
                  {todos
                    .filter(article => article.status === 1)
                    .map((article) => (
                      <Box key={article.id} p={4} border="1px" borderColor="gray.200" borderRadius="md">
                        <Flex align="center" justify="space-between">
                          <Checkbox
                            isChecked={selectedArticles.includes(article.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedArticles([...selectedArticles, article.id]);
                              } else {
                                setSelectedArticles(selectedArticles.filter(id => id !== article.id));
                                // Remove category when article is deselected
                                setArticleCategories(prev => {
                                  const newCategories = { ...prev };
                                  delete newCategories[article.id];
                                  return newCategories;
                                });
                              }
                            }}
                            size="md"
                            colorScheme="blue"
                          >
                            <Text fontWeight="medium">{article.keyword}</Text>
                          </Checkbox>
                          
                          {selectedArticles.includes(article.id) && (
                            <Box minW="150px">
                              <select 
                                value={articleCategories[article.id] || ''}
                                onChange={(e) => {
                                  setArticleCategories(prev => ({
                                    ...prev,
                                    [article.id]: e.target.value
                                  }));
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                }}
                              >
                                <option value="">Select Category</option>
                                {(() => {
                                  const mywebsite = userWebsites.find((website) => website.id.toString() === selectedWebsiteId);
                                  return mywebsite && (mywebsite as any).categories ? 
                                    JSON.parse((mywebsite as any).categories).map((category: any, index: number) => 
                                      <option key={index} value={category.name || category}>
                                        {category.name || category}
                                      </option>
                                    ) : null;
                                })()}
                              </select>
                            </Box>
                          )}
                        </Flex>
                      </Box>

                    ))}
                </VStack>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="blue"
              onClick={() => {
                onArticleSelectClose();
                onAuthorSelectOpen();
              }}
              isDisabled={selectedArticles.length === 0}
            >
              Next
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Author Selection Modal */}
      <Modal isOpen={isAuthorSelectOpen} onClose={onAuthorSelectClose} size="xl">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? '#060d36' : '#fff'}>
          <ModalHeader>Select Author for Articles</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack align="stretch" spacing={6}>
              <Text fontSize="sm" color="text-slate-500">
                Select an author for all selected articles
              </Text>
              
              {/* Author Selection */}
              <Box>
                <Text fontSize="md" fontWeight="medium" mb={3}>
                  Author:
                </Text>
                <Box maxW="300px">
                  <select 
                    value={selectedAuthor}
                    onChange={(e) => {
                      setSelectedAuthor(parseInt(e.target.value));
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">Select Author</option>
                    {(() => {
                      const mywebsite = userWebsites.find((website) => website.id.toString() === selectedWebsiteId);
                      return mywebsite && (mywebsite as any).authors ? 
                        JSON.parse((mywebsite as any).authors).map((author: any, index: number) => 
                          <option key={index} value={author.id}>
                            {author.name}
                          </option>
                        ) : null;
                    })()}
                  </select>
                </Box>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              mr={3}
              onClick={() => {
                onAuthorSelectClose();
                onArticleSelectOpen();
              }}
            >
              Back
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => {
                onAuthorSelectClose();
                onPublishingSettingsOpen();
              }}
            >
              Next
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Website Selection Modal */}
      <Modal isOpen={isWebsiteSelectOpen} onClose={handleWebsiteSelectClose} size="md">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? '#060d36' : '#fff'}>
          <ModalHeader>Select WordPress Website</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack align="stretch" spacing={4}>
              <Text fontSize="sm" color="text-slate-500" mb={4}>
                Select the website you want to publish these articles to
              </Text>
              {isLoadingWebsites ? (
                <Spinner size="sm" color="blue.500" />
              ) : userWebsites.length === 0 ? (
                <Text color="gray.500">No WordPress sites found. Please add a site first.</Text>
              ) : (
                <RadioGroup value={selectedWebsiteId} onChange={setSelectedWebsiteId}>
                  <VStack align="stretch" spacing={3}>
                    {userWebsites.map((website) => (
                      <Radio
                        key={website.id}
                        value={website.id.toString()}
                        size="lg"
                        colorScheme="blue"
                      >
                        <Text fontWeight="medium">{website.name}</Text>
                      </Radio>
                    ))}
                  </VStack>
                </RadioGroup>
              )}
            </VStack>
            <br/>
            <Flex justify="flex-start">
            <Button 
              colorScheme="blue" 
              onClick={() => {
                onWebsiteSelectClose();
                onSetupOpen();
              }}
            >
              Add New Website
            </Button>
            </Flex>

          </ModalBody>
          <ModalFooter>
            <Button 
              colorScheme="blue" 
              onClick={() => {
                onWebsiteSelectClose();
                onArticleSelectOpen();
              }}
              isDisabled={!selectedWebsiteId}
            >
              Next
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Setup Instructions Modal */}
      <Modal isOpen={isSetupOpen} onClose={onSetupClose} size="md">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? '#060d36' : '#fff'}>
          <ModalHeader>Auto Publish articles to WordPress</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack align="stretch" spacing={6}>
              <Text fontSize="sm" color="text-slate-500" mb={4}>
                Follow these steps to auto publish articles to your blog
              </Text>
              <VStack align="stretch" spacing={4}>
                <Flex align="center" gap={4}>
                  <Flex
                    bg="black"
                    color="white"
                    borderRadius="full"
                    w="30px"
                    h="30px"
                    align="center"
                    justify="center"
                    fontWeight="bold"
                    flexShrink={0}
                  >
                    1
                  </Flex>
                  <Text fontWeight="medium">
                    Click here to Download{" "}
                    <Text as="span" textDecoration="underline" color="blue.500" cursor="pointer">
                     <Link href="https://firebasestorage.googleapis.com/v0/b/virtualnod-storage.firebasestorage.app/o/whoneedsawriter%2Fplugin%2FWhoneedsawriter.zip?alt=media&token=1eb99f55-88d9-4614-9849-e2b80187a744" target="_blank">WordPress Plugin</Link>
                    </Text>
                  </Text>
                </Flex>
                
                <Flex align="center" gap={4}>
                  <Flex
                    bg="black"
                    color="white"
                    borderRadius="full"
                    w="30px"
                    h="30px"
                    align="center"
                    justify="center"
                    fontWeight="bold"
                    flexShrink={0}
                  >
                    2
                  </Flex>
                  <Text fontWeight="medium">
                    Install Plugin on the site you want to publish on
                  </Text>
                </Flex>
                
                <Flex align="center" gap={4}>
                  <Flex
                    bg="black"
                    color="white"
                    borderRadius="full"
                    w="30px"
                    h="30px"
                    align="center"
                    justify="center"
                    fontWeight="bold"
                    flexShrink={0}
                  >
                    3
                  </Flex>
                  <Text fontWeight="medium">
                   Connect with the same Email ID used on Whoneedsawriter.com
                  </Text>
                </Flex>
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button 
              colorScheme="blue" 
              isLoading={isLoadingWebsites}
              loadingText="Verifying..."
              onClick={async () => {
                try {
                  setIsLoadingWebsites(true);
                  // Get user websites
                  const response = await fetch('/api/user-websites');
                  if (!response.ok) {
                    throw new Error('Failed to fetch websites');
                  }
                  const websites = await response.json();
                  
                  if (websites && websites.length > userWebsites.length) {
                    setUserWebsites(websites.map((site: UserWebsite) => ({
                      ...site,
                      checked: false
                    })));
                    toast.success('The website added successfully');
                    onSetupClose();
                    onWebsiteSelectOpen();
                  } else {
                    toast.error('Plugin could not be found on any website. Please try again.');
                  }
                } catch (error) {
                  console.error('Error checking websites:', error);
                  toast.error('Plugin could not be found on any website. Please try again.');
                } finally {
                  setIsLoadingWebsites(false);
                }
              }}
            >
              Verify & Proceed
            </Button>
            </ModalFooter>
          </ModalContent>
      </Modal>

      {/* Update Plugin Modal */}
      <Modal isOpen={isUpdatePluginOpen} onClose={onUpdatePluginClose} size="lg">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? '#060d36' : '#fff'}>
          <ModalHeader>Update Plugin</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {/* List here*/}
            <ul className="list-disc list-inside">
              <li className="mb-4">Download the plugin from the link below</li>
              <li className="mb-4">Deactivate and delete the existing plugin on your wordpress website</li>
              <li className="mb-4">Install and activate the new plugin on the website</li>
              <li className="mb-4">Verify the plugin is installed and activated at whoneedsawriter.com</li>
            </ul>
            <br/>
            <Flex justify="center">
              <Button colorScheme="blue" onClick={() => {
                window.open('https://firebasestorage.googleapis.com/v0/b/virtualnod-storage.firebasestorage.app/o/whoneedsawriter%2Fplugin%2FWhoneedsawriter.zip?alt=media&token=1eb99f55-88d9-4614-9849-e2b80187a744', '_blank');
              }}>Download Plugin</Button>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Publishing Settings Modal */}
      <Modal isOpen={isPublishingSettingsOpen} onClose={handlePublishingSettingsClose} size="lg">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? '#060d36' : '#fff'}>
          <ModalHeader>Publishing Settings</ModalHeader>
          <ModalCloseButton onClick={handlePublishingSettingsClose} />
          <ModalBody pb={6}>
            <Flex direction="row" gap={8}>
              {/* Left Section */}
              <VStack align="stretch" spacing={4} flex={1}>
                <Text fontWeight="medium" fontSize="sm">
                  How do you want to save the articles on your blog
                </Text>
                <VStack align="stretch" spacing={3}>
                  <Checkbox
                    isChecked={publishingSettings.saveOption === 'draft'}
                    onChange={() => setPublishingSettings(prev => ({ ...prev, saveOption: 'draft' }))}
                    size="md"
                    colorScheme="blue"
                  >
                    Save as Draft
                  </Checkbox>
                  <Checkbox
                    isChecked={publishingSettings.saveOption === 'publish'}
                    onChange={() => setPublishingSettings(prev => ({ ...prev, saveOption: 'publish' }))}
                    size="md"
                    colorScheme="blue"
                  >
                    Publish Now
                  </Checkbox>
                  <Checkbox
                    isChecked={publishingSettings.saveOption === 'future'}
                    onChange={() => setPublishingSettings(prev => ({ ...prev, saveOption: 'future' }))}
                    size="md"
                    colorScheme="blue"
                  >
                    Schedule for Future
                  </Checkbox>
                </VStack>
                {publishingSettings.saveOption === 'future' && (
                  <Box>
                    <Select
                      value={publishingSettings.scheduleTime || ''}
                      onChange={(e) => setPublishingSettings(prev => ({ ...prev, scheduleTime: e.target.value }))}
                      size="md"
                      colorScheme="blue"
                    >
                      <option value="one_post_per_day">One post daily</option>
                      <option value="one_post_weekly">One post weekly</option>
                    </Select>
                    </Box>
                )}
              </VStack>

              {/* Divider */}
              <Box w="1px" bg="gray.200" />

              {/* Right Section */}
              <VStack align="stretch" spacing={4} flex={1}>
                <Text fontWeight="medium" fontSize="sm">
                  Choose what you want to publish
                </Text>
                <VStack align="stretch" spacing={3}>
                  <Checkbox
                    isChecked={publishingSettings.addFeaturedImage}
                    onChange={(e) => setPublishingSettings(prev => ({ ...prev, addFeaturedImage: e.target.checked }))}
                    size="md"
                    colorScheme="blue"
                  >
                    Add Featured Image
                  </Checkbox>
                  <Checkbox
                    isChecked={publishingSettings.addMetaContent}
                    onChange={(e) => setPublishingSettings(prev => ({ ...prev, addMetaContent: e.target.checked }))}
                    size="md"
                    colorScheme="blue"
                  >
                    <Flex align="center" gap={2}>
                      <Text>Add Meta Content</Text>
                      <Tooltip 
                        label="We support Rank Math & Yoast SEO plugins" 
                        placement="top" 
                        hasArrow
                        color="#333333"
                        bg="#ffffff"
                      >
                        <Box display="inline-flex" alignItems="center">
                          <BsFillQuestionCircleFill size={16} color="text-slate-500"/>
                        </Box>
                      </Tooltip>
                    </Flex>
                  </Checkbox>
                </VStack>
              </VStack>
            </Flex>
          </ModalBody>
          <ModalFooter justifyContent="center">
            <VStack spacing={4}>
              <Button
                variant="outline"
                colorScheme="black"
                onClick={handlePublish}
                px={8}
                py={2}
                isLoading={isPublishing && publishingProgress.current > 0 && !publishingProgress.isCompleted}
                loadingText="Publishing..."
                isDisabled={isPublishing}
              >
                {publishingProgress.isCompleted ? 'Completed' : 'Submit'}
              </Button>
              {/* Publishing Progress - Only show during active publishing */}
              { isPublishing && (
                <VStack spacing={3} align="stretch" w="full">
                  {publishingProgress.current > 0 && !publishingProgress.isCompleted && (
                    <Text fontSize="sm" color="text-slate-500" textAlign="center">
                      Please wait while publishing the articles, do not close this page.
                    </Text>
                  )}
                  
                  {/* Progress Bar - Only show during active publishing */}
                  {publishingProgress.current > 0 && !publishingProgress.isCompleted && (
                    <Box w="full" bg="gray.200" borderRadius="full" h="2">
                      <Box 
                        bg="blue.500" 
                        h="2" 
                        borderRadius="full" 
                        transition="width 0.3s ease"
                        w={`${publishingProgress.total > 0 ? (publishingProgress.current / publishingProgress.total) * 100 : 0}%`}
                      />
                    </Box>
                  )}
                  
                  {/* Progress Text */}
                  <Text fontSize="sm" color="text-slate-600" textAlign="center">
                    {publishingProgress.current > 0 && publishingProgress.total > 0 && !publishingProgress.isCompleted && (
                      <>
                        Publishing: {publishingProgress.currentArticle} ({publishingProgress.current}/{publishingProgress.total})
                      </>
                    )}
                  </Text>
                </VStack>
              )}
              
              {/* Publishing Results - Show after completion */}
              {(publishingProgress.completed.length > 0 || publishingProgress.failed.length > 0) && (
                <VStack spacing={3} align="stretch" w="full">
                  {/* Completed Articles */}
                  {publishingProgress.completed.length > 0 && (
                    <Box>
                      <Text fontSize="sm" color="text-slate-500" fontWeight="medium" mb={2}>
                        ✅ Successfully published ({publishingProgress.completed.length}):
                      </Text>
                      <VStack align="stretch" spacing={1}>
                        {publishingProgress.completed.map((article, index) => (
                          <Text key={index} fontSize="xs" color="text-slate-500" pl={2}>
                            • {article}
                          </Text>
                        ))}
                      </VStack>
                    </Box>
                  )}
                  
                  {/* Failed Articles */}
                  {publishingProgress.failed.length > 0 && (
                    <Box>
                      <Text fontSize="sm" color="red.600" fontWeight="medium" mb={2}>
                        ❌ Could not publish articles. ({publishingProgress.failed.length}):
                      </Text>
                      <VStack align="stretch" spacing={1}>
                        {publishingProgress.failed.map((article, index) => (
                          <Text key={index} fontSize="xs" color="red.500" pl={2}>
                            • {article}
                          </Text>
                        ))}
                      </VStack>
                    </Box>
                  )}

                  {/* error message*/}
                  {publishingFailedMessage && publishingFailedMessage === 'Plugin version is outdated' && (
                    <Box>
                      <Text fontSize="sm" color="red.800" bg="white" p={2} borderRadius="lg" fontWeight="medium" mb={2}>
                         {publishingFailedMessage}. <span className="text-underline cursor-pointer" onClick={() => {
                          onUpdatePluginOpen();
                          handlePublishingSettingsClose();
                         }}>Click here</span> to update the plugin.
                      </Text>
                    </Box>
                  )}

                </VStack>
              )}
            </VStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
      </Container>
      </div>
    </Flex>
  );
};

export default ArticlesList;

const DeleteTodoDialog = ({
  todo,
  isOpen,
  onClose,
}: {
  todo: GodmodeArticles | undefined;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const deleteTodoMutation = useMutation({
    mutationFn: async (todoId: string) => {
      const response = await fetch("/api/article-generator", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: todoId }),
      });
      if (!response.ok) {
        throw new Error("Failed to delete article");
      }
      return response.json();
    },
    onSuccess: (_, deletedTodoId) => {
      toast.success("Article deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
    onError: (error) => {
      toast.error("Error deleting article");
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
            This will permanently delete the article <strong>{todo?.keyword}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteTodoMutation.mutate(todo?.id || "")}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const EditTodoDialog = ({
  isLoading,
  isOpen,
  onClose,
  onUpdate,
  todo,
}: {
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (todo: Pick<GodmodeArticles, "id" | "batchId" | "content" >) => Promise<void>;
  todo: GodmodeArticles | undefined;
}) => {
  const [text, setText] = useState(todo?.batchId || "");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Todo</DialogTitle>
          <DialogDescription>
            Update your item, mark as complete.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="text" className="w-24 text-right">
              Todo
            </Label>
            <div className="flex-1">
              <Input
                id="text"
                defaultValue={todo?.batchId}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="is-completed" className="w-24 text-right">
              Done
            </Label>

          </div>
        </div>
        <DialogFooter>
          {/* <Button
            type="submit"
            isLoading={isLoading}
            colorScheme="brand"
            onClick={async () => {
              await onUpdate({
                id: todo?.id || "",
                content,
              });
              onClose();
            }}
          >
            Save changes
          </Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};