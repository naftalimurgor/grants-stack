import { ethers } from "ethers";
import { fetchFromIPFS, graphql_fetch } from "./utils";
import {
  ApplicationStatus,
  Eligibility,
  MetadataPointer,
  Project,
  Round,
} from "./types";

/**
 * Shape of subgraph response
 */
export interface GetRoundByIdResult {
  data: {
    rounds: RoundResult[];
  };
}

/**
 * Shape of subgraph response of Round
 */
interface RoundResult {
  id: string;
  program: {
    id: string;
  };
  roundMetaPtr: MetadataPointer;
  applicationMetaPtr: MetadataPointer;
  applicationsStartTime: string;
  applicationsEndTime: string;
  roundStartTime: string;
  roundEndTime: string;
  token: string;
  votingStrategy: {
    id: string;
  };
  projectsMetaPtr?: MetadataPointer | null;
  projects: RoundProjectResult[];
}

interface RoundProjectResult {
  id: string;
  project: string;
  status: string | number;
  applicationIndex: number;
  metaPtr: MetadataPointer;
}

/**
 * Shape of IPFS content of Round RoundMetaPtr
 */
type RoundMetadata = {
  name: string;
  eligibility: Eligibility;
  programContractAddress: string;
};

export type RoundProject = {
  id: string;
  status: ApplicationStatus;
  payoutAddress: string;
};

export async function getRoundById(
  roundId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chainId: any
): Promise<Round> {
  try {
    // get the subgraph for round by $roundId
    const res: GetRoundByIdResult = await graphql_fetch(
      `
        query GetRoundById($roundId: String) {
          rounds(where: {
            id: $roundId
          }) {
            id
            program {
              id
            }
            roundMetaPtr {
              protocol
              pointer
            }
            applicationMetaPtr {
              protocol
              pointer
            }
            applicationsStartTime
            applicationsEndTime
            roundStartTime
            roundEndTime
            token
            votingStrategy {
              id
            }
            projectsMetaPtr {
              pointer
            }
            projects(first: 1000) {
              id
              project
              status
              applicationIndex
              metaPtr {
                      protocol
                      pointer
              }
            }
          }
        }
      `,
      chainId,
      { roundId }
    );

    const round: RoundResult = res.data.rounds[0];

    const roundMetadata: RoundMetadata = await fetchFromIPFS(
      round.roundMetaPtr.pointer
    );

    round.projects = round.projects.map((project) => {
      return {
        ...project,
        status: convertStatus(project.status),
      };
    });

    const approvedProjectsWithMetadata = await loadApprovedProjects(
      round,
      chainId
    );

    return {
      id: roundId,
      roundMetadata,
      applicationsStartTime: new Date(
        parseInt(round.applicationsStartTime) * 1000
      ),
      applicationsEndTime: new Date(parseInt(round.applicationsEndTime) * 1000),
      roundStartTime: new Date(parseInt(round.roundStartTime) * 1000),
      roundEndTime: new Date(parseInt(round.roundEndTime) * 1000),
      token: round.token,
      votingStrategy: round.votingStrategy.id,
      ownedBy: round.program.id,
      approvedProjects: approvedProjectsWithMetadata,
    };
  } catch (error) {
    console.error("getRoundById", error);
    throw Error("Unable to fetch round");
  }
}

function convertStatus(status: string | number) {
  switch (status) {
    case 0:
      return "PENDING";
    case 1:
      return "APPROVED";
    case 2:
      return "REJECTED";
    case 3:
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

async function loadApprovedProjects(
  round: RoundResult,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chainId: any
): Promise<Project[]> {
  if (round.projects.length === 0) {
    return [];
  }

  const allRoundProjects = round.projects;

  const approvedProjects = allRoundProjects.filter(
    (project) => project.status === ApplicationStatus.APPROVED
  );
  const fetchApprovedProjectMetadata: Promise<Project>[] = approvedProjects.map(
    (project: RoundProjectResult) =>
      fetchMetadataAndMapProject(project, chainId)
  );

  return Promise.all(fetchApprovedProjectMetadata);
}

async function fetchMetadataAndMapProject(
  project: RoundProjectResult,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chainId: any
): Promise<Project> {
  const applicationData = await fetchFromIPFS(project.metaPtr.pointer);
  // NB: applicationData can be in two formats:
  // old format: { round, project, ... }
  // new format: { signature: "...", application: { round, project, ... } }
  const application = applicationData.application || applicationData;
  const projectMetadataFromApplication = application.project;
  const projectRegistryId = `0x${projectMetadataFromApplication.id}`;
  const projectOwners = await getProjectOwners(chainId, projectRegistryId);

  return {
    grantApplicationId: project.id,
    grantApplicationFormAnswers: application.answers,
    projectRegistryId: project.project,
    recipient: application.recipient,
    projectMetadata: {
      ...projectMetadataFromApplication,
      owners: projectOwners.map((address: string) => ({ address })),
    },
    status: ApplicationStatus.APPROVED,
    applicationIndex: project.applicationIndex,
  };
}

export async function getProjectOwners(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chainId: any,
  projectRegistryId: string
) {
  try {
    // get the subgraph for project owners by $projectRegistryId
    const res = await graphql_fetch(
      `
        query GetProjectOwners($projectRegistryId: String) {
          projects(where: {
            id: $projectRegistryId
          }) {
            id
            accounts {
              account {
                address
              }
            }
          }
        }
      `,
      chainId,
      { projectRegistryId },
      true
    );

    return (
      res.data?.projects[0]?.accounts.map(
        (account: { account: { address: string } }) =>
          ethers.utils.getAddress(account.account.address)
      ) || []
    );
  } catch (error) {
    console.log("getProjectOwners", error);
    throw Error("Unable to fetch project owners");
  }
}
