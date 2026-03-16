import { VStack, Spinner, Flex } from "@chakra-ui/react";
import { Heading } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

type ResearchData = {
  websiteUrl: string;
  topic: string;
  description: string;
  goal: string;
}
const PROGRESS_MESSAGES = [
  "Understanding your niche & audience…",
  "Finding keyword clusters…",
  "Mapping intent (lead vs info)…",
  "Finalizing topic ideas…",
];

export const RenderFormStep: React.FC<{
  step: number;
  researchData: ResearchData;
  setResearchData: (data: ResearchData) => void;
  error: string | null;
  progress?: number;
  isProcessing: boolean;
  keywordResearchResult: number;
} > = ({
  step,
  researchData,
  setResearchData,
  error,
  progress = 0,
  isProcessing,
  keywordResearchResult,
}) => {
    const router = useRouter();
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setResearchData({ ...researchData, [e.target.name]: e.target.value });
    }
    switch (step) {
        case 1:
            return (
                <VStack align="flex-start" spacing={2} width="100%">
                  <Heading className={`font-semibold text-lg text-[#7f8aa3] px-[22px]`}>Choose Your Input</Heading>
                  <p className="text-[13px] text-[#7f8aa3] px-[22px]">Enter a Website URL or a Topic. At least one is required.</p>
                  <hr style={{ height: '1px', width: '100%' }} />
                 <div className="px-[22px]">
                  <div className="rounded-xl border bg-[#1b2232] px-4 py-3 text-sm text-[#7f8aa3] mt-[20px] mb-[20px]">
                    <b>Note:</b> Enter either Website URL <i>or</i> Topic. You can fill both, but at least one is required.
                  </div>
            <div className="space-y-2 mb-[30px]">
              {error && 
               <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
               <span className="font-semibold">Error:</span>
               <span className="ml-2 text-red-800">{error}</span>
             </div>
              }
                  <label className="text-sm font-medium text-[#7f8aa3]">Website URL <span>(Optional)</span></label>
                  <input
                    id="websiteUrl"
                    type="url"
                    placeholder="https://example.com"
                    className="flex-grow text-[13px] placeholder:text-[#7f8aa3] placeholder:text-[13px]"
                    value={researchData.websiteUrl}
                    onChange={(e) => setResearchData({ ...researchData, websiteUrl: e.target.value })}
                  />
                  <p className="text-xs text-[#7f8aa3]">If provided, we’ll analyze your website niche and existing positioning.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#7f8aa3]">Topic <span>(Optional)</span></label>
                  <input
                    id="topic"
                    type="text"
                    placeholder="e.g., fitness coaching for women, interior design for small apartments..."
                    className="flex-grow text-[13px] placeholder:text-[#7f8aa3] placeholder:text-[13px]"
                    value={researchData.topic}
                    onChange={(e) => setResearchData({ ...researchData, topic: e.target.value })}
                  />
                  <p className="text-xs text-[#7f8aa3]">If you don’t have a website yet, just enter your topic.</p>
                </div>
              </div>
                </VStack>
            );
        case 2:
            return (
              <VStack align="flex-start" spacing={2} width="100%">
              <Heading className={`font-semibold text-lg text-[#7f8aa3] px-[22px]`}>Description (Required)</Heading>
              <p className="text-[13px] text-[#7f8aa3] px-[22px]">Add details so the keyword list is accurate.</p>
              <hr style={{ height: '1px', width: '100%' }} />
             <div className="px-[22px] w-full">
        <div className="space-y-2 mb-[30px]">
             {error && 
               <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span className="font-semibold">Error:</span>
                <span className="ml-2 text-red-800">{error}</span>
               </div>
              }
              <label className="text-sm font-medium text-[#7f8aa3]">Description</label>
              <textarea
                    id="description"
                    rows={8}
                    placeholder="Describe your business, audience, and what you want to rank for. Mention your location, services, competitors, tone, and content style if any."
                    className="text-sm w-full flex-grow ca text-[13px] placeholder:text-[#7f8aa3] placeholder:text-[13px]"
                    value={researchData.description}
                    onChange={(e) => setResearchData({ ...researchData, description: e.target.value })}
                  ></textarea>
                  <p className="text-xs text-[#7f8aa3]">The better your description, the more accurate the keyword list.</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button type="button" className="chip rounded-full border bg-[#1b2232] px-3 py-1 text-xs text-[#7f8aa3]">Who is your target audience?</button>
                    <button type="button" className="chip rounded-full border bg-[#1b2232] px-3 py-1 text-xs text-[#7f8aa3]">What do you sell/offer?</button>
                    <button type="button" className="chip rounded-full border bg-[#1b2232] px-3 py-1 text-xs text-[#7f8aa3]">Which country/city are you targeting?</button>
                    <button type="button" className="chip rounded-full border bg-[#1b2232] px-3 py-1 text-xs text-[#7f8aa3]">Any competitor examples?</button>
                  </div>
            </div>
          </div>
            </VStack>
            );

        case 3:
            return (
              <VStack align="flex-start" spacing={2} width="100%">
              <Heading className={`font-semibold text-lg text-[#7f8aa3] px-[22px]`}>Select Goal (Required)</Heading>
              <p className="text-[13px] text-[#7f8aa3] px-[22px]">Choose the type of keywords you want.</p>
              <hr style={{ height: '1px', width: '100%' }} />
             <div className="px-[22px] w-full">
        <div className="space-y-2 mb-[30px]">
            {error && 
               <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
               <span className="font-semibold">Error:</span>
               <span className="ml-2 text-red-800">{error}</span>
             </div>
              }
              <label className="text-sm font-medium text-[#7f8aa3]">Goal</label>
              <div className="space-y-3">
  <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-[#1b2232] p-4">
    <input className="mt-1 w-[30px]" type="radio" name="goal" value="Lead Generation Articles" checked={researchData.goal === 'Lead Generation Articles'} onChange={(e) => setResearchData({ ...researchData, goal: e.target.value })} />
    <div className="flex-1">
      <div className="font-semibold text-sm text-[#7f8aa3]">Lead Generation Articles</div>
      <div className="text-xs text-[#7f8aa3]">Keywords designed to bring inquiries, bookings, and purchases.</div>
    </div>
  </label>

  <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-[#1b2232] p-4">
    <input className="mt-1 w-[30px]" type="radio" name="goal" value="Informational Content" checked={researchData.goal === 'Informational Content'} onChange={(e) => setResearchData({ ...researchData, goal: e.target.value })} />
    <div className="flex-1">
      <div className="font-semibold text-sm text-[#7f8aa3]">Informational Content</div>
      <div className="text-xs text-[#7f8aa3]">Keywords designed for traffic, awareness, and trust-building.</div>
    </div>
  </label>

  <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-[#1b2232] p-4">
    <input className="mt-1 w-[30px]" type="radio" name="goal" value="Any Relevant Article for my audience" checked={researchData.goal === 'Any Relevant Article for my audience'} onChange={(e) => setResearchData({ ...researchData, goal: e.target.value })} />
    <div className="flex-1">
      <div className="font-semibold text-sm text-[#7f8aa3]">Any Relevant Article for my audience</div>
      <div className="text-xs text-[#7f8aa3]">A mixed list of lead + info keywords.</div>
    </div>
  </label>
</div>
            </div>
          </div>
            </VStack>
            );
        case 4:
            return (
              <VStack align="flex-start" spacing={2} width="100%">
              <Heading className={`font-semibold text-lg text-[#7f8aa3] px-[22px]`}>Review & Generate</Heading>
              <p className="text-[13px] text-[#7f8aa3] px-[22px]">Confirm everything, then generate your report.</p>
              <hr style={{ height: '1px', width: '100%' }} />
             <div className="px-[22px] w-full">
        <div className="space-y-2 mb-[30px]">
              
              <div className="space-y-3">

              <div className="rounded-2xl border bg-[#1b2232] p-5 mt-[20px]">
                  <dl className="mt-4 grid gap-4">
                    <div>
                      <dt className="text-xs font-semibold text-[#7f8aa3]">Website URL</dt>
                      <dd id="reviewWebsite" className="text-sm text-[#7f8aa3]">{researchData.websiteUrl || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-[#7f8aa3]">Topic</dt>
                      <dd id="reviewTopic" className="text-sm text-[#7f8aa3]">{researchData.topic || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-[#7f8aa3]">Goal</dt>
                      <dd id="reviewGoal" className="text-sm text-[#7f8aa3]">{researchData.goal || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-[#7f8aa3]">Description</dt>
                      <dd className="text-sm text-[#7f8aa3]">
                        <span id="reviewDescShort">{researchData.description || 'Not provided'}</span>
                        <button id="viewMoreBtn" type="button" className="ml-2 text-sm font-semibold text-slate-700 underline hover:text-slate-900 hidden">
                          View more
                        </button>
                      </dd>
                    </div>
                  </dl>
                </div>
                <p className="text-xs text-[#7f8aa3]">This usually takes about <b>3–5 minutes</b> depending on the depth of analysis.</p>
             </div>

            </div>
          </div>
            </VStack>
            );
        case 5:
            return (
              <VStack align="flex-start" spacing={2} width="100%">
              <Heading className={`font-semibold text-lg text-[#7f8aa3] px-[22px]`}>Generating your keyword research…</Heading>
              <p className="text-[13px] text-[#7f8aa3] px-[22px]">Please keep this tab open. This usually takes 3–5 minutes.</p>
              <hr style={{ height: '1px', width: '100%' }} />
              { isProcessing && (
              <div>
              <div className="px-[22px] w-full space-y-3 mb-[20px] mt-[20px]">
                <div className="w-full h-[5px] bg-[#1b2232] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2c5282] rounded-full transition-all duration-800 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
                <Flex alignItems="center" gap={3}>
                  <Spinner size="sm" color="#2c5282" />
                  <p className="text-sm font-medium text-[#eef2f7]">
                    {PROGRESS_MESSAGES[Math.min(3, Math.floor((progress / 100) * PROGRESS_MESSAGES.length))]}
                  </p>
                </Flex>
              </div>
              
                <div className="px-[22px] w-full mt-4">
                  <div className="border border-[#ffffff14] rounded-lg p-4">
                    <p className="text-sm text-[#7f8aa3] mb-3 text-center">We will email you the report once completed , you can go to the dashboard </p>
                    <div className="flex items-center justify-center gap-2 w-full mt-[20px]">
                      <button
                        type="button"
                        onClick={() => {
                          router.push('/dashboard');
                        }}
                        className="text-sm font-medium text-white bg-[#2c5282] px-4 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        GO TO DASHBOARD
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}

              { keywordResearchResult === 1 && (
                                <div className="px-[22px] w-full mt-4">
                                <div className="border border-[#ffffff14] rounded-lg p-4">
                                  <p className="text-sm text-[#7f8aa3] mb-3 text-center">Keyword generation completed successfully</p>
                                  <div className="flex items-center justify-center gap-2 w-full mt-[20px]">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        router.push('/dashboard');
                                      }}
                                      className="text-sm font-medium text-white bg-[#2c5282] px-4 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      VIEW KEYWORD REPORT
                                    </button>
                                  </div>
                                </div>
                              </div>
              )}
              { keywordResearchResult === 2 && (
                                <div className="px-[22px] w-full mt-4">
                                <div className="border border-[#ffffff14] rounded-lg p-4">
                                  <p className="text-sm text-[#ff0000] mb-3 text-center">Keyword research is taking longer than expected, we will send you an update on email once completed.</p>
                                  <div className="flex items-center justify-center gap-2 w-full mt-[20px]">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        router.push('/dashboard');
                                      }}
                                      className="text-sm font-medium text-white bg-[#2c5282] px-4 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      GO TO DASHBOARD
                                    </button>
                                  </div>
                                </div>
                              </div>
              )}
              { keywordResearchResult === 3 && (
                                <div className="px-[22px] w-full mt-4">
                                <div className="border border-[#ffffff14] rounded-lg p-4">
                                  <p className="text-sm text-[#ff0000] mb-3 text-center">Keyword generation failed, please try again.</p>
                                  <div className="flex items-center justify-center gap-2 w-full mt-[20px]">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        router.push('/dashboard');
                                      }}
                                      className="text-sm font-medium text-white bg-[#2c5282] px-4 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      GO TO DASHBOARD
                                    </button>
                                  </div>
                                </div>
                              </div>
              )}
            </VStack>
            );
        }
    }