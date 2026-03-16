"use client";

import React from "react";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DashboardHeader from "@/components/organisms/DashboardHeader/DashboardHeader";

type KeywordDetailRecord = {
  id: string;
  website_url: string | null;
  description: string | null;
  seedKeyword: string | null;
  goal: string | null;
  json: string | null;
  createdAt: string;
};

type KeywordRow = {
  keyword: string;
  volume: string;
};

function parseKeywordRows(json: string | null): KeywordRow[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);

    const fromArray = (arr: unknown[]): KeywordRow[] => {
      return arr
        .map((item) => {
          if (
            item &&
            typeof item === "object" &&
            "keyword" in item
          ) {
            const o = item as Record<string, unknown>;
            const keyword = String(o.keyword ?? "").trim();
            const volumeRaw =
              o.volume ??
              (o.search_volume as unknown | undefined) ??
              (o.searchVolume as unknown | undefined);
            const volume =
              volumeRaw === undefined || volumeRaw === null || volumeRaw === ""
                ? "N/A"
                : String(volumeRaw);
            if (!keyword) return null;
            return { keyword, volume };
          }
          if (typeof item === "string") {
            const keyword = item.trim();
            if (!keyword) return null;
            return { keyword, volume: "N/A" };
          }
          return null;
        })
        .filter((x): x is KeywordRow => x !== null);
    };

    if (Array.isArray(parsed)) {
      return fromArray(parsed);
    }
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      if (Array.isArray(o.keywords)) {
        return fromArray(o.keywords as unknown[]);
      }
      if (Array.isArray(o.data)) {
        return fromArray(o.data as unknown[]);
      }
    }
  } catch {
    // ignore malformed JSON
  }
  return [];
}

const KeywordDetails: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const id = searchParams.get("id");

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["keyword-details", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/keyword-research/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch keyword details");
      }
      return res.json() as Promise<{ keyword: KeywordDetailRecord }>;
    },
  });

  const record = data?.keyword;
  const topic = record?.seedKeyword || "";
  const websiteUrl = record?.website_url || "";
  const description = record?.description || "";

  const rows = React.useMemo(
    () => parseKeywordRows(record?.json ?? null),
    [record?.json]
  );

  const handleCopyKeywords = async () => {
    const text = rows.map((r) => r.keyword).join(", ");
    if (!text) {
      toast({
        title: "No keywords to copy",
        status: "info",
        duration: 2000,
        isClosable: true,
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Keywords copied",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch {
      toast({
        title: "Failed to copy keywords",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleDownloadCsv = () => {
    if (!rows.length) {
      toast({
        title: "No data to download",
        status: "info",
        duration: 2000,
        isClosable: true,
      });
      return;
    }
    const header = "Keyword,Volume";
    const csvLines = rows.map((r) =>
      `"${r.keyword.replace(/"/g, '""')}",${r.volume === "N/A" ? "" : r.volume}`
    );
    const csv = [header, ...csvLines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "keywords.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Flex justifyContent="flex-start" w="100%" minH="100vh">
      <div className="flex-col w-full">
        <DashboardHeader />
        <Container
          px="27px"
          pt={["15px", "15px", "96px"]}
          alignItems="flex-center"
          maxWidth="900px"
          mb="56px"
        >
          <VStack align="flex-start" spacing={6} w="100%">
            <Heading size="md">Keyword Research Details</Heading>

            {!id && (
              <Text color="red.500">Missing keyword generation id.</Text>
            )}
            {id && isLoading && <Text>Loading...</Text>}
            {id && error && (
              <Text color="red.500">
                {(error as Error).message || "Failed to load details."}
              </Text>
            )}

            {record && (
              <>
                <Box>
                  <Text fontWeight="medium">
                    Topic:{" "}
                    <Text as="span" fontWeight="normal" color="#7f8aa3">
                      {topic || "—"}
                    </Text>
                  </Text>
                  <Text fontWeight="medium">
                    Website URL:{" "}
                    <Text as="span" fontWeight="normal" color="#7f8aa3">
                      {websiteUrl || "—"}
                    </Text>
                  </Text>
                  <Text fontWeight="medium">
                    Description:{" "}
                    <Text as="span" fontWeight="normal" color="#7f8aa3">
                      {description || "—"}
                    </Text>
                  </Text>
                </Box>

                <Flex gap={3} flexWrap="wrap">
                  <Button colorScheme="brand" onClick={() => router.push("/article-generator")}>
                    Generate Articles
                  </Button>
                  <Button variant="outline" onClick={handleCopyKeywords}>
                    Copy Keywords
                  </Button>
                  <Button variant="outline" onClick={handleDownloadCsv}>
                    Download CSV
                  </Button>
                </Flex>

                <Box w="100%" className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-left">Keyword</TableHead>
                        <TableHead className="text-left">Volume</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length ? (
                        rows.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-left">
                              {row.keyword}
                            </TableCell>
                            <TableCell className="text-left">
                              {row.volume}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="h-24 text-center"
                          >
                            No keyword data available.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>
              </>
            )}
          </VStack>
        </Container>
      </div>
    </Flex>
  );
};

export default KeywordDetails;