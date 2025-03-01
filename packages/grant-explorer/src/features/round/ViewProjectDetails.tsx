import { datadogLogs } from "@datadog/browser-logs";
import { Link, useParams } from "react-router-dom";
import { useRoundById } from "../../context/RoundContext";
import { ProjectBanner } from "../common/ProjectBanner";
import DefaultLogoImage from "../../assets/default_logo.png";
import { PassportVerifier } from "@gitcoinco/passport-sdk-verifier";
import {
  GrantApplicationFormAnswer,
  Project,
  ProjectCredentials,
  ProjectMetadata,
} from "../api/types";
import { VerifiableCredential } from "@gitcoinco/passport-sdk-types";
import {
  BoltIcon,
  ChevronLeftIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/solid";
import { ReactComponent as TwitterIcon } from "../../assets/twitter-logo.svg";
import { ReactComponent as GithubIcon } from "../../assets/github-logo.svg";
import { Button } from "common/src/styles";
import { useCart } from "../../context/CartContext";
import Navbar from "../common/Navbar";
import React, { useEffect, useState } from "react";
import Footer from "../common/Footer";
import useSWR from "swr";
import { formatDistanceToNowStrict } from "date-fns";
import RoundEndedBanner from "../common/RoundEndedBanner";
import PassportBanner from "../common/PassportBanner";
import { formatDateWithOrdinal } from "common";
import { renderToHTML } from "common";
import { Client, Application } from "allo-indexer-client";
import { utils } from "ethers";

const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 0C3.44772 0 3 0.447715 3 1V2H2C0.895431 2 0 2.89543 0 4V14C0 15.1046 0.895431 16 2 16H14C15.1046 16 16 15.1046 16 14V4C16 2.89543 15.1046 2 14 2H13V1C13 0.447715 12.5523 0 12 0C11.4477 0 11 0.447715 11 1V2H5V1C5 0.447715 4.55228 0 4 0ZM4 5C3.44772 5 3 5.44772 3 6C3 6.55228 3.44772 7 4 7H12C12.5523 7 13 6.55228 13 6C13 5.44772 12.5523 5 12 5H4Z"
        fill="#757087"
      />
    </svg>
  );
};

enum VerifiedCredentialState {
  VALID,
  INVALID,
  PENDING,
}

const boundFetch = fetch.bind(window);

export const IAM_SERVER =
  "did:key:z6MkghvGHLobLEdj1bgRLhS4LPGJAvbMA1tn2zcRyqmYU5LC";

const verifier = new PassportVerifier();

export default function ViewProjectDetails() {
  datadogLogs.logger.info(
    "====> Route: /round/:chainId/:roundId/:applicationId"
  );
  datadogLogs.logger.info(`====> URL: ${window.location.href}`);
  const { chainId, roundId, applicationId } = useParams();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { round, isLoading } = useRoundById(chainId!, roundId!);

  const projectToRender = round?.approvedProjects?.find(
    (project) => project.grantApplicationId === applicationId
  );

  const currentTime = new Date();
  const isBeforeRoundEndDate = round && round.roundEndTime > currentTime;
  const isAfterRoundEndDate = round && round.roundEndTime <= currentTime;
  const [cart, handleAddProjectsToCart, handleRemoveProjectsFromCart] =
    useCart();

  const isAlreadyInCart = cart.some(
    (project) => project.grantApplicationId === applicationId
  );

  return (
    <>
      <Navbar roundUrlPath={`/round/${chainId}/${roundId}`} />
      {isBeforeRoundEndDate && <PassportBanner />}
      {isAfterRoundEndDate && (
        <div>
          <RoundEndedBanner />
        </div>
      )}
      <div className="relative top-16 lg:mx-20 h-screen px-4 py-7">
        <main>
          <div className="flex flex-row items-center gap-3 text-sm">
            <ChevronLeftIcon className="h-5 w-5 mt-6 mb-6" />
            <Link to={`/round/${chainId}/${roundId}`}>
              <span className="font-normal">Back to Grants</span>
            </Link>
          </div>
          {!isLoading && projectToRender && (
            <>
              <Header projectMetadata={projectToRender.projectMetadata} />
              <div className="flex flex-col md:flex-row">
                <div className="grow">
                  <div>
                    <ProjectTitle
                      projectMetadata={projectToRender.projectMetadata}
                    />
                    <AboutProject projectToRender={projectToRender} />
                  </div>
                  <div>
                    <DescriptionTitle />
                    <Detail
                      text={projectToRender.projectMetadata.description}
                      testID="project-metadata"
                    />
                    <ApplicationFormAnswers
                      answers={projectToRender.grantApplicationFormAnswers}
                    />
                  </div>
                </div>
                <Sidebar
                  isAlreadyInCart={isAlreadyInCart}
                  removeFromCart={() => {
                    handleRemoveProjectsFromCart([projectToRender]);
                  }}
                  addToCart={() => {
                    handleAddProjectsToCart([projectToRender]);
                  }}
                />
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
}

function Header(props: { projectMetadata: ProjectMetadata }) {
  return (
    <div>
      <ProjectBanner
        projectMetadata={props.projectMetadata}
        classNameOverride="h-32 w-full object-cover lg:h-80 rounded"
      />
      <div className="pl-4 sm:pl-6 lg:pl-8">
        <div className="-mt-12 sm:-mt-16 sm:flex sm:items-end sm:space-x-5">
          <div className="flex">
            <ProjectLogo
              projectMetadata={props.projectMetadata}
              classNameOverride="h-24 w-24 rounded-full ring-4 ring-white bg-white sm:h-32 sm:w-32"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectTitle(props: { projectMetadata: ProjectMetadata }) {
  return (
    <div className="border-b-2 pb-2">
      <h1 className="text-3xl mt-6 font-thin text-black">
        {props.projectMetadata.title}
      </h1>
    </div>
  );
}

function AboutProject(props: { projectToRender: Project }) {
  const [verifiedProviders, setVerifiedProviders] = useState<{
    [key: string]: VerifiedCredentialState;
  }>({
    github: VerifiedCredentialState.PENDING,
    twitter: VerifiedCredentialState.PENDING,
  });

  const { projectToRender } = props;
  const projectRecipient =
    projectToRender.recipient.slice(0, 6) +
    "..." +
    projectToRender.recipient.slice(-4);
  const projectWebsite = projectToRender.projectMetadata.website;
  const projectTwitter = projectToRender.projectMetadata.projectTwitter;
  const userGithub = projectToRender.projectMetadata.userGithub;
  const projectGithub = projectToRender.projectMetadata.projectGithub;

  const date = new Date(projectToRender.projectMetadata.createdAt ?? 0);
  const formattedDateWithOrdinal = `Created on: ${formatDateWithOrdinal(date)}`;

  useEffect(() => {
    if (projectToRender?.projectMetadata?.owners) {
      const credentials: ProjectCredentials =
        projectToRender?.projectMetadata.credentials ?? {};

      if (!credentials) {
        return;
      }
      const verify = async () => {
        const newVerifiedProviders: { [key: string]: VerifiedCredentialState } =
          { ...verifiedProviders };
        for (const provider of Object.keys(verifiedProviders)) {
          const verifiableCredential = credentials[provider];
          if (verifiableCredential) {
            newVerifiedProviders[provider] = await isVerified(
              verifiableCredential,
              verifier,
              provider,
              projectToRender
            );
          }
        }

        setVerifiedProviders(newVerifiedProviders);
      };
      verify();
    }
  }, [projectToRender?.projectMetadata.owners]); // eslint-disable-line react-hooks/exhaustive-deps

  const getVerifiableCredentialVerificationResultView = (provider: string) => {
    switch (verifiedProviders[provider]) {
      case VerifiedCredentialState.VALID:
        return (
          <span className="rounded-full bg-teal-100 px-2.5 inline-flex flex-row justify-center items-center">
            <ShieldCheckIcon
              className="w-5 h-5 text-teal-500 mr-2"
              data-testid={`${provider}-verifiable-credential`}
            />
            <p className="text-teal-500 font-medium text-xs">Verified</p>
          </span>
        );
      default:
        return <></>;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 border-b-2 pt-2 pb-6">
      {projectRecipient && (
        <span className="flex items-center mt-4 gap-1">
          <BoltIcon className="h-4 w-4 mr-1 opacity-40" />
          <DetailSummary
            text={`${projectRecipient}`}
            testID="project-recipient"
            sm={true}
          />
        </span>
      )}
      {projectWebsite && (
        <span className="flex items-center mt-4 gap-1">
          <GlobeAltIcon className="h-4 w-4 mr-1 opacity-40" />
          <a
            href={projectWebsite}
            target="_blank"
            rel="noreferrer"
            className="text-base font-normal text-black"
          >
            <DetailSummary
              text={`${projectWebsite}`}
              testID="project-website"
            />
          </a>
        </span>
      )}
      {projectTwitter && (
        <span className="flex items-center mt-4 gap-1">
          <TwitterIcon className="h-4 w-4 mr-1 opacity-40" />
          <a
            href={`https://twitter.com/${projectTwitter}`}
            target="_blank"
            rel="noreferrer"
            className="text-base font-normal text-black"
          >
            <DetailSummary
              text={`@${projectTwitter}`}
              testID="project-twitter"
            />
          </a>
          {getVerifiableCredentialVerificationResultView("twitter")}
        </span>
      )}
      {projectToRender.projectMetadata.createdAt && (
        <span className="flex items-center mt-4 gap-1">
          <CalendarIcon className="h-4 w-4 mr-1 opacity-80" />
          <DetailSummary
            text={`${formattedDateWithOrdinal}`}
            testID="project-createdAt"
          />
        </span>
      )}
      {userGithub && (
        <span className="flex items-center mt-4 gap-1">
          <GithubIcon className="h-4 w-4 mr-1 opacity-40" />
          <a
            href={`https://github.com/${userGithub}`}
            target="_blank"
            rel="noreferrer"
            className="text-base font-normal text-black"
          >
            <DetailSummary text={`${userGithub}`} testID="user-github" />
          </a>
        </span>
      )}
      {projectGithub && (
        <span className="flex items-center mt-4 gap-1">
          <GithubIcon className="h-4 w-4 mr-1 opacity-40" />
          <a
            href={`https://github.com/${projectGithub}`}
            target="_blank"
            rel="noreferrer"
            className="text-base font-normal text-black"
          >
            <DetailSummary text={`${projectGithub}`} testID="project-github" />
          </a>
          {getVerifiableCredentialVerificationResultView("github")}
        </span>
      )}
    </div>
  );
}

function DescriptionTitle() {
  return <h1 className="text-2xl mt-8 font-thin text-black">About</h1>;
}

function DetailSummary(props: { text: string; testID: string; sm?: boolean }) {
  return (
    <p
      className={`${props.sm ? "text-sm" : "text-base"} font-normal text-black`}
      data-testid={props.testID}
    >
      {" "}
      {props.text}{" "}
    </p>
  );
}

function Detail(props: { text: string; testID: string }) {
  return (
    <p
      dangerouslySetInnerHTML={{
        __html: renderToHTML(props.text.replace(/\n/g, "\n\n")),
      }}
      className="text-md prose prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-a:text-blue-600"
      data-testid={props.testID}
    />
  );
}

function ApplicationFormAnswers(props: {
  answers: GrantApplicationFormAnswer[];
}) {
  // only show answers that are not empty and are not marked as hidden
  const answers = props.answers.filter((a) => !!a.answer && !a.hidden);

  if (answers.length === 0) {
    return null;
  }

  return (
    <div>
      <h1 className="text-2xl mt-8 font-thin text-black">
        Additional Information
      </h1>
      <div>
        {answers.map((answer) => {
          const answerText = Array.isArray(answer.answer)
            ? answer.answer.join(", ")
            : answer.answer;
          return (
            <div key={answer.questionId}>
              <p className="text-md mt-8 mb-3 font-semibold text-black">
                {answer.question}
              </p>
              {answer.type === "paragraph" ? (
                <p
                  dangerouslySetInnerHTML={{
                    __html: renderToHTML(answerText.replace(/\n/g, "\n\n")),
                  }}
                  className="text-md prose prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-a:text-blue-600"
                ></p>
              ) : (
                <p className="text-base text-black">
                  {answerText.replace(/\n/g, "<br/>")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectLogo(props: {
  projectMetadata: ProjectMetadata;
  classNameOverride?: string;
}) {
  const { projectMetadata, classNameOverride } = props;

  const applicationLogoImage = projectMetadata.logoImg
    ? `https://${process.env.REACT_APP_PINATA_GATEWAY}/ipfs/${projectMetadata.logoImg}`
    : DefaultLogoImage;

  return (
    <div className="pl-4">
      <div className="-mt-6 sm:-mt-6 sm:flex sm:items-end sm:space-x-5">
        <div className="flex">
          <img
            className={
              classNameOverride ??
              "h-12 w-12 rounded-full ring-4 ring-white bg-white"
            }
            src={applicationLogoImage}
            alt="Project Logo"
          />
        </div>
      </div>
    </div>
  );
}

function Sidebar(props: {
  isAlreadyInCart: boolean;
  removeFromCart: () => void;
  addToCart: () => void;
}) {
  return (
    <div className="mt-6 md:mt-0 self-center md:self-auto md:ml-6">
      <ProjectStats />
      <CartButtonToggle
        isAlreadyInCart={props.isAlreadyInCart}
        addToCart={props.addToCart}
        removeFromCart={props.removeFromCart}
      />
    </div>
  );
}

// NOTE: Consider moving this
export function useRoundProject(
  chainId: number,
  roundId: string,
  projectId: string
) {
  // use chain id and project id from url params
  const client = new Client(
    boundFetch,
    process.env.REACT_APP_ALLO_API_ENDPOINT ?? "",
    chainId
  );
  return useSWR([roundId, "/projects"], ([roundId]) =>
    client
      .getRoundApplications(utils.getAddress(roundId.toLowerCase()))
      .then((apps: Application[]) =>
        apps.filter((app: Application) => app.id === projectId)
      )
  );
}
export function ProjectStats() {
  const { chainId, roundId, applicationId } = useParams();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { round } = useRoundById(chainId!, roundId!);
  const projectId = applicationId?.split("-")[0] as string;

  const { data: project } = useRoundProject(
    Number(chainId),
    roundId as string,
    projectId
  );

  const timeRemaining = round?.roundEndTime
    ? formatDistanceToNowStrict(round.roundEndTime)
    : null;

  return (
    <div className={"rounded bg-gray-50 mb-4 p-4 gap-4 flex flex-col"}>
      <div>
        <h3>${project ? project[0].amountUSD.toFixed(2) : "-"}</h3>
        <p>funding received in current round</p>
      </div>
      <div>
        <h3>{project ? project[0].uniqueContributors : "-"}</h3>
        <p>contributors</p>
      </div>
      <div>
        {(round?.roundEndTime ?? 0) > new Date() ? (
          <>
            <h3>{timeRemaining ?? "-"}</h3>
            <p>to go</p>
          </>
        ) : (
          <>
            <p>Round ended</p>
            <h3>{timeRemaining} ago</h3>
          </>
        )}
      </div>
    </div>
  );
}

function CartButtonToggle(props: {
  isAlreadyInCart: boolean;
  addToCart: () => void;
  removeFromCart: () => void;
}) {
  // if the project is not added, show the add to cart button
  // if the project is added to the cart, show the remove from cart button
  if (props.isAlreadyInCart) {
    return (
      <Button
        data-testid="remove-from-cart"
        onClick={props.removeFromCart}
        className={
          "w-80 bg-transparent hover:bg-red-500 text-red-400 font-semibold hover:text-white py-2 px-4 border border-red-400 hover:border-transparent rounded"
        }
      >
        Remove from Cart
      </Button>
    );
  }

  return (
    <Button
      data-testid="add-to-cart"
      onClick={() => {
        props.addToCart();
      }}
      className={
        "w-80 bg-transparent hover:bg-violet-400 text-grey-900 font-semibold hover:text-white py-2 px-4 border border-violet-400 hover:border-transparent rounded"
      }
    >
      Add to Cart
    </Button>
  );
}

function vcProviderMatchesProject(
  provider: string,
  verifiableCredential: VerifiableCredential,
  project: Project | undefined
) {
  let vcProviderMatchesProject = false;
  if (provider === "twitter") {
    vcProviderMatchesProject =
      verifiableCredential.credentialSubject.provider
        ?.split("#")[1]
        .toLowerCase() ===
      project?.projectMetadata.projectTwitter?.toLowerCase();
  } else if (provider === "github") {
    vcProviderMatchesProject =
      verifiableCredential.credentialSubject.provider
        ?.split("#")[1]
        .toLowerCase() ===
      project?.projectMetadata.projectGithub?.toLowerCase();
  }
  return vcProviderMatchesProject;
}

function vcIssuedToAddress(vc: VerifiableCredential, address: string) {
  const vcIdSplit = vc.credentialSubject.id.split(":");
  const addressFromId = vcIdSplit[vcIdSplit.length - 1];
  return addressFromId === address;
}

async function isVerified(
  verifiableCredential: VerifiableCredential,
  verifier: PassportVerifier,
  provider: string,
  project: Project | undefined
) {
  const vcHasValidProof = await verifier.verifyCredential(verifiableCredential);
  const vcIssuedByValidIAMServer = verifiableCredential.issuer === IAM_SERVER;
  const providerMatchesProject = vcProviderMatchesProject(
    provider,
    verifiableCredential,
    project
  );
  const vcIssuedToAtLeastOneProjectOwner = (
    project?.projectMetadata?.owners ?? []
  ).some((owner) => vcIssuedToAddress(verifiableCredential, owner.address));

  return vcHasValidProof &&
    vcIssuedByValidIAMServer &&
    providerMatchesProject &&
    vcIssuedToAtLeastOneProjectOwner
    ? VerifiedCredentialState.VALID
    : VerifiedCredentialState.INVALID;
}
