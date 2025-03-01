import { datadogLogs } from "@datadog/browser-logs";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronUpDownIcon,
  EyeIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";
import { Button, Input } from "common/src/styles";
import { Listbox, Transition } from "@headlessui/react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { BigNumber, ethers } from "ethers";
import React, { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAccount, useBalance, useNetwork } from "wagmi";
import DefaultLogoImage from "../../assets/default_logo.png";
import { modalDelayMs } from "../../constants";
import { useCart } from "../../context/CartContext";
import { useQFDonation } from "../../context/QFDonationContext";
import { useRoundById } from "../../context/RoundContext";
import {
  fetchPassport,
  PassportResponse,
  PassportState,
} from "../api/passport";
import { renderToPlainText } from "common";
import {
  CartDonation,
  PayoutToken,
  ProgressStatus,
  Project,
  recipient,
} from "../api/types";
import { classNames, getPayoutTokenOptions } from "../api/utils";
import ConfirmationModal from "../common/ConfirmationModal";
import ErrorModal from "../common/ErrorModal";
import Footer from "../common/Footer";
import InfoModal from "../common/InfoModal";
import Navbar from "../common/Navbar";
import PassportBanner from "../common/PassportBanner";
import ProgressModal from "../common/ProgressModal";
import RoundEndedBanner from "../common/RoundEndedBanner";
import { Logger } from "ethers/lib.esm/utils";
import { TrashIcon } from "@heroicons/react/24/outline";
import ReactTooltip from "react-tooltip";

export default function ViewCart() {
  const { chainId, roundId } = useParams();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { round } = useRoundById(chainId!, roundId!);

  const payoutTokenOptions: PayoutToken[] = [
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ...getPayoutTokenOptions(chainId!),
  ];

  const [selectedPayoutToken, setSelectedPayoutToken] = useState<PayoutToken>(
    payoutTokenOptions[0]
  );
  const [donations, setDonations] = useState<CartDonation[]>([]);

  const totalDonation = useMemo(() => {
    return donations.reduce((acc, donation) => {
      if (donation.amount == "") {
        donation.amount = "0";
      }

      const decimalPlaces =
        (donation.amount.match(/\.(\d+)/) || [])[1]?.length || 0;
      return Number((acc + parseFloat(donation.amount)).toFixed(decimalPlaces));
    }, 0);
  }, [donations]);

  const currentTime = new Date();
  const isBeforeRoundEndDate = round && round.roundEndTime > currentTime;
  const isAfterRoundEndDate = round && round.roundEndTime <= currentTime;

  const [fixedDonation, setFixedDonation] = useState<number>();
  const [openConfirmationModal, setOpenConfirmationModal] = useState(false);
  const [openInfoModal, setOpenInfoModal] = useState(false);
  const [openProgressModal, setOpenProgressModal] = useState(false);
  const [openErrorModal, setOpenErrorModal] = useState(false);
  const [errorModalSubHeading, setErrorModalSubHeading] = useState<
    string | undefined
  >();
  const [transactionReplaced, setTransactionReplaced] = useState(false);
  const [cart] = useCart();

  const { openConnectModal } = useConnectModal();
  const { chain, chains } = useNetwork();
  const { address, isConnected } = useAccount();

  const tokenDetail =
    selectedPayoutToken.address == ethers.constants.AddressZero
      ? { addressOrName: address }
      : { addressOrName: address, token: selectedPayoutToken.address };

  const selectedPayoutTokenBalance = useBalance(tokenDetail);

  const [wrongChain, setWrongChain] = useState(false);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  const [emptyInput, setEmptyInput] = useState(false);

  /* Donate without matching warning modal */
  const [donateWarningModalOpen, setDonateWarningModalOpen] = useState(false);

  const navigate = useNavigate();

  const {
    submitDonations,
    tokenApprovalStatus,
    voteStatus,
    indexingStatus,
    txHash,
  } = useQFDonation();

  useEffect(() => {
    if (
      tokenApprovalStatus === ProgressStatus.IS_ERROR ||
      voteStatus === ProgressStatus.IS_ERROR
    ) {
      setTimeout(() => {
        setOpenProgressModal(false);
        if (transactionReplaced) {
          setErrorModalSubHeading("Transaction cancelled. Please try again.");
        }
        setOpenErrorModal(true);
      }, modalDelayMs);
    }

    if (indexingStatus === ProgressStatus.IS_ERROR) {
      setTimeout(() => {
        navigate(`/round/${chainId}/${roundId}`);
      }, 5000);
    }

    if (
      tokenApprovalStatus === ProgressStatus.IS_SUCCESS &&
      voteStatus === ProgressStatus.IS_SUCCESS &&
      txHash !== ""
    ) {
      setTimeout(() => {
        setOpenProgressModal(false);
        navigate(`/round/${chainId}/${roundId}/${txHash}/thankyou`);
      }, modalDelayMs);
    }
  }, [
    navigate,
    tokenApprovalStatus,
    voteStatus,
    indexingStatus,
    chainId,
    roundId,
    txHash,
    transactionReplaced,
  ]);

  const [, setPassport] = useState<PassportResponse | undefined>();
  const [, setError] = useState<Response | undefined>();

  const [passportState, setPassportState] = useState<PassportState>(
    PassportState.LOADING
  );
  useEffect(() => {
    setPassportState(PassportState.LOADING);

    // TODO: fetch from round metadata
    const PASSPORT_COMMUNITY_ID =
      process.env.REACT_APP_PASSPORT_API_COMMUNITY_ID;
    const PASSPORT_THRESHOLD = 0;

    if (isConnected && address && PASSPORT_COMMUNITY_ID) {
      const callFetchPassport = async () => {
        const res = await fetchPassport(address, PASSPORT_COMMUNITY_ID);
        if (res.ok) {
          const json = await res.json();

          if (json.status == "PROCESSING") {
            console.log("processing, calling again in 3000 ms");
            setTimeout(async () => {
              await callFetchPassport();
            }, 3000);
            return;
          } else if (json.status == "ERROR") {
            // due to error at passport end
            setPassportState(PassportState.ERROR);
            return;
          }

          setPassport(json);
          setPassportState(
            json.score >= PASSPORT_THRESHOLD
              ? PassportState.MATCH_ELIGIBLE
              : PassportState.MATCH_INELIGIBLE
          );
        } else {
          setError(res);
          switch (res.status) {
            case 400: // unregistered/nonexistent passport address
              setPassportState(PassportState.INVALID_PASSPORT);
              break;
            case 401: // invalid API key
              setPassportState(PassportState.ERROR);
              console.error("invalid API key", res.json());
              break;
            default:
              setPassportState(PassportState.ERROR);
              console.error("Error fetching passport", res);
          }
        }
      };

      callFetchPassport();
    } else {
      setPassportState(PassportState.NOT_CONNECTED);
    }
  }, [address, isConnected]);

  const progressSteps = [
    {
      name: "Approve",
      description: "Approve the contract to access your wallet",
      status: tokenApprovalStatus,
    },
    {
      name: "Submit",
      description: "Finalize your contribution",
      status: voteStatus,
    },
    {
      name: "Indexing",
      description: "The subgraph is indexing the data.",
      status: indexingStatus,
    },
    {
      name: "Redirecting",
      description: "Just another moment while we finish things up.",
      status:
        indexingStatus === ProgressStatus.IS_SUCCESS
          ? ProgressStatus.IN_PROGRESS
          : ProgressStatus.NOT_STARTED,
    },
  ];

  return (
    <>
      <Navbar roundUrlPath={`/round/${chainId}/${roundId}`} />
      {isBeforeRoundEndDate && (
        <PassportBanner chainId={chainId} roundId={roundId} />
      )}
      {isAfterRoundEndDate && (
        <div>
          <RoundEndedBanner />
        </div>
      )}
      {}
      <div className="relative top-16 lg:mx-20 h-screen px-4 py-7">
        <main>
          {Header(chainId, roundId)}
          <div className="flex flex-col md:flex-row gap-5">
            {cart.length == 0 ? EmptyCart() : CartWithProjects(cart)}
            {SummaryContainer()}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );

  function ApplyTooltip() {
    return (
      <>
        <InformationCircleIcon
          data-tip
          data-background-color="#5932C4"
          data-for="apply-tooltip"
          className="inline h-4 w-4 ml-1 mb-1 mt-4"
          data-testid={"apply-tooltip"}
        />

        <ReactTooltip
          id="apply-tooltip"
          place="bottom"
          type="dark"
          effect="solid"
        >
          <p className="text-xs">
            Apply the same donation amount <br />
            to all of the projects you currently <br />
            have in your cart. You can also set <br />
            individual donation amounts <br />
            below.
          </p>
        </ReactTooltip>
      </>
    );
  }

  function SummaryContainer() {
    return (
      <>
        <div>
          <Summary />
          <Button
            $variant="solid"
            data-testid="handle-confirmation"
            type="button"
            onClick={() => {
              /* Check if user hasn't connected passport yet, display the warning modal */
              if (
                passportState === PassportState.ERROR ||
                passportState === PassportState.NOT_CONNECTED ||
                passportState === PassportState.INVALID_PASSPORT
              ) {
                setDonateWarningModalOpen(true);
                return;
              }

              /* If passport is fine, proceed straight to confirmation */
              handleConfirmation();
            }}
            disabled={isAfterRoundEndDate}
            className="items-center shadow-sm text-sm rounded w-full"
          >
            Submit your donation!
          </Button>
          <p className="flex justify-center my-4 text-sm italic">
            Your donation to each project must be valued at $1 USD or more to be
            eligible for matching.
          </p>
          {emptyInput && (
            <p
              data-testid="emptyInput"
              className="rounded-md bg-red-50 py-2 text-pink-500 flex justify-center my-4 text-sm"
            >
              <InformationCircleIcon className="w-4 h-4 mr-1 mt-0.5" />
              <span>You must enter donations for all the projects</span>
            </p>
          )}
          {insufficientBalance && !wrongChain && (
            <p
              data-testid="insufficientBalance"
              className="rounded-md bg-red-50 py-2 text-pink-500 flex justify-center my-4 text-sm"
            >
              <InformationCircleIcon className="w-4 h-4 mr-1 mt-0.5" />
              <span>You do not have enough funds for these donations</span>
            </p>
          )}
          {wrongChain && (
            <p
              data-testid="wrongChain"
              className="rounded-md bg-red-50 py-2 text-pink-500 flex justify-center my-4 text-sm"
            >
              <InformationCircleIcon className="w-4 h-4 mr-1 mt-0.5" />
              <span>
                You are on the wrong chain ({chain?.name}) for this round.
                <br />
                Please switch to{" "}
                {chains.filter((c) => c?.id == Number(chainId))[0]?.name}{" "}
                network.
              </span>
            </p>
          )}
        </div>
        <PayoutModals />
      </>
    );
  }

  function Header(chainId?: string, roundId?: string) {
    return (
      <div>
        <div className="flex flex-row items-center gap-3 text-sm">
          <ChevronLeftIcon className="h-5 w-5 mt-6 mb-6 cursor-pointer" />
          <Link to={`/round/${chainId}/${roundId}`}>
            <span className="font-normal">Back</span>
          </Link>
        </div>

        <h1 className="text-3xl mt-6 font-thin border-b-2 pb-2">Cart</h1>

        <p className="my-5">
          Welcome to your cart! Choose how you want to fund the projects you’ve
          chosen to support.
        </p>
      </div>
    );
  }

  function CartWithProjects(cart: Project[]) {
    return (
      <div className="grow block px-[16px] py-4 rounded-lg shadow-lg bg-white border">
        <div className="flex flex-col md:flex-row justify-between border-b-2 pb-2 gap-3">
          <div className="basis-[28%]">
            <h2 className="mt-2 text-xl">Projects</h2>
          </div>
          <div className="lg:flex justify-end lg:flex-row gap-2 basis-[72%] ">
            <div className="flex gap-4">
              <p className="mt-3 text-sm amount-text">Amount</p>
              <Input
                aria-label={"Donation amount for all projects "}
                id={"input-donationamount"}
                min="0"
                value={fixedDonation ?? ""}
                type="number"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFixedDonation(Number(e.target.value));
                }}
                className="w-24"
              />
              <PayoutTokenDropdown payoutTokenOptions={payoutTokenOptions} />
            </div>
            <div className="flex flex-row">
              <Button
                type="button"
                $variant="outline"
                onClick={() => {
                  updateAllDonations(fixedDonation ?? 0);
                }}
                className="float-right md:float-none text-xs px-4 py-2 text-purple-600 border-0"
              >
                Apply to all
              </Button>
              <ApplyTooltip />
            </div>
          </div>
        </div>
        <div className="my-4">
          {cart.map((project: Project, key: number) => (
            <div key={key}>
              <ProjectInCart
                project={project}
                index={key}
                roundRoutePath={`/round/${chainId}/${roundId}`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  function ProjectInCart(
    props: React.ComponentProps<"div"> & {
      project: Project;
      index: number;
      roundRoutePath: string;
    }
  ) {
    const { project, roundRoutePath } = props;
    const [
      ,
      ,
      //cart,
      //handleAddProjectsToCart
      handleRemoveProjectsFromCart,
    ] = useCart();

    const focusedElement = document?.activeElement?.id;
    const inputID = "input-" + props.index;

    return (
      <div data-testid="cart-project" className="border-b-2 border-grey-100">
        <div className="mb-4 flex flex-col md:flex-row justify-between px-3 py-4 rounded-md">
          <div className="flex">
            <div className="relative overflow-hidden bg-no-repeat bg-cover  min-w-[64px] w-16 max-h-[64px] mt-auto mb-auto">
              <img
                className="inline-block"
                src={
                  props.project.projectMetadata.logoImg
                    ? `https://${process.env.REACT_APP_PINATA_GATEWAY}/ipfs/${props.project.projectMetadata.logoImg}`
                    : DefaultLogoImage
                }
                alt={"Project Logo"}
              />
              <div className="min-w-[64px] w-16 max-h-[64px] absolute top-0 right-0 bottom-0 left-0 overflow-hidden bg-fixed opacity-0 hover:opacity-70 transition duration-300 ease-in-out bg-gray-500 justify-center flex items-center">
                <Link to={`${roundRoutePath}/${project.grantApplicationId}`}>
                  <EyeIcon
                    className="fill-gray-200 w-6 h-6 cursor-pointer"
                    data-testid={`${project.projectRegistryId}-project-link`}
                  />
                </Link>
              </div>
            </div>

            <div className="pl-4 mt-1">
              <Link
                to={`${roundRoutePath}/${project.grantApplicationId}`}
                data-testid={"cart-project-link"}
              >
                <p className="font-semibold mb-2 text-ellipsis line-clamp-1">
                  {props.project.projectMetadata.title}
                </p>
              </Link>
              <p className="text-sm text-ellipsis line-clamp-3">
                {renderToPlainText(
                  props.project.projectMetadata.description
                ).substring(0, 130)}
              </p>
            </div>
          </div>

          <div className="mt-1 flex space-x-2 sm:space-x-4 h-16 pl-4 pt-3">
            <Input
              aria-label={
                "Donation amount for project " +
                props.project.projectMetadata.title
              }
              id={inputID}
              key={inputID}
              {...(focusedElement === inputID ? { autoFocus: true } : {})}
              min="0"
              value={
                donations.find(
                  (donation: CartDonation) =>
                    donation.projectRegistryId ===
                    props.project.projectRegistryId
                )?.amount
              }
              type="number"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                updateDonations(
                  props.project.projectRegistryId,
                  e.target.value,
                  props.project.recipient,
                  props.project.applicationIndex
                );
              }}
              className="w-24"
            />
            <p className="m-auto">{selectedPayoutToken.name}</p>
            <TrashIcon
              data-testid="remove-from-cart"
              onClick={() => {
                handleRemoveProjectsFromCart([props.project]);
                updateDonations(
                  props.project.projectRegistryId,
                  "",
                  props.project.recipient,
                  props.project.applicationIndex
                );
              }}
              className="w-5 h-5 m-auto cursor-pointer mb-4"
            />
          </div>
        </div>
      </div>
    );
  }

  function EmptyCart() {
    return (
      <div className="grow block px-[16px] py-4 rounded-lg shadow-lg bg-white border border-violet-400">
        <div className="flex flex-row justify-between border-b-2 pb-2 gap-3">
          <div className="basis-[28%]">
            <h2 className="mt-2 text-xl">Projects</h2>
          </div>
          <div className="lg:flex justify-end lg:flex-row gap-2 basis-[72%] ">
            <p className="mt-3 text-sm amount-text">Amount</p>
            <Input
              aria-label={"Donation amount for all projects "}
              id={"input-donationamount"}
              min="0"
              value={fixedDonation ?? ""}
              type="number"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setFixedDonation(Number(e.target.value));
              }}
              className="w-24"
            />
            <PayoutTokenDropdown payoutTokenOptions={payoutTokenOptions} />
            <Button
              type="button"
              $variant="outline"
              className="text-xs px-4 py-2 text-purple-600 border-0"
            >
              Apply to all
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-grey-500">Cart is empty.</p>
        </div>
      </div>
    );
  }

  function Summary() {
    return (
      <div className="shrink mb-5 block px-[16px] py-4 rounded-lg shadow-lg bg-white border border-violet-400 font-semibold">
        <h2 className="text-xl border-b-2 pb-2">Summary</h2>
        <div className="flex justify-between mt-4">
          <p>Your Contribution</p>
          <p>
            <span data-testid={"totalDonation"} className="mr-2">
              {totalDonation.toString()}
            </span>
            <span data-testid={"summaryPayoutToken"}>
              {selectedPayoutToken.name}
            </span>
          </p>
        </div>
      </div>
    );
  }

  function AdditionalGasFeesNote() {
    return (
      <p className="text-sm italic text-grey-400 mb-2">
        Changes could be subject to additional gas fees.
      </p>
    );
  }

  function ProjectsInCartCount() {
    return (
      <div className="flex justify-center" data-testid="cart-project-count">
        <CheckIcon
          className="bg-teal-400 text-grey-500 rounded-full h-6 w-6 p-1 mr-2"
          aria-hidden="true"
        />
        <p className="font-bold">
          <span className="mr-1">{totalDonation}</span>
          <span className="mr-1">{selectedPayoutToken.name}</span>
          <span>Contributed</span>
        </p>
      </div>
    );
  }

  function updateDonations(
    projectRegistryId: string,
    amount: string,
    projectAddress: recipient,
    applicationIndex: number
  ) {
    const projectIndex = donations.findIndex(
      (donation) => donation.projectRegistryId === projectRegistryId
    );

    const newState = [...donations];

    if (projectIndex !== -1) {
      newState[projectIndex].amount = amount;
    } else {
      newState.push({
        projectRegistryId,
        amount,
        projectAddress,
        applicationIndex
      });
    }

    setDonations(newState);
  }

  function updateAllDonations(amount: number) {
    const newDonations = cart.map((project) => {
      return {
        projectRegistryId: project.projectRegistryId,
        amount: amount.toString(),
        projectAddress: project.recipient,
        applicationIndex: project.applicationIndex
      } as CartDonation;
    });

    setDonations(newDonations);
  }

  function PayoutTokenDropdown(props: { payoutTokenOptions: PayoutToken[] }) {
    return (
      <div className="mt-1 relative col-span-6 sm:col-span-3">
        <Listbox value={selectedPayoutToken} onChange={setSelectedPayoutToken}>
          {({ open }) => (
            <div>
              <div className="mb-2 shadow-sm block rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <PayoutTokenButton
                  token={props.payoutTokenOptions.find(
                    (t) => t.address === selectedPayoutToken?.address
                  )}
                />
                <Transition
                  show={open}
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {props.payoutTokenOptions.map(
                      (token) =>
                        !token.default && (
                          <Listbox.Option
                            key={token.name}
                            className={({ active }) =>
                              classNames(
                                active
                                  ? "text-white bg-indigo-600"
                                  : "text-gray-900",
                                "relative cursor-default select-none py-2 pl-3 pr-9"
                              )
                            }
                            value={token}
                            data-testid="payout-token-option"
                          >
                            {({ selected, active }) => (
                              <>
                                <div className="flex items-center">
                                  {token.logo ? (
                                    <img
                                      src={token.logo}
                                      alt=""
                                      className="h-6 w-6 flex-shrink-0 rounded-full"
                                    />
                                  ) : null}
                                  <span
                                    className={classNames(
                                      selected
                                        ? "font-semibold"
                                        : "font-normal",
                                      "ml-3 block truncate"
                                    )}
                                  >
                                    {token.name}
                                  </span>
                                </div>

                                {selected ? (
                                  <span
                                    className={classNames(
                                      active ? "text-white" : "text-indigo-600",
                                      "absolute inset-y-0 right-0 flex items-center pr-4"
                                    )}
                                  >
                                    <CheckIcon
                                      className="h-5 w-5"
                                      aria-hidden="true"
                                    />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </Listbox.Option>
                        )
                    )}
                  </Listbox.Options>
                </Transition>
              </div>
            </div>
          )}
        </Listbox>
      </div>
    );
  }

  function PayoutTokenButton(props: { token?: PayoutToken }) {
    const { token } = props;
    return (
      <Listbox.Button
        className="relative w-[130px] cursor-default rounded-md border h-10 border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
        data-testid="payout-token-select"
      >
        <span className="flex items-center">
          {token?.logo ? (
            <img
              src={token?.logo}
              alt=""
              className="h-6 w-6 flex-shrink-0 rounded-full"
            />
          ) : null}
          {token?.default ? (
            <span className="ml-3 block truncate text-gray-500">
              {token?.name}
            </span>
          ) : (
            <span className="ml-3 block truncate">{token?.name}</span>
          )}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2">
          <ChevronUpDownIcon
            className="h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </span>
      </Listbox.Button>
    );
  }

  function handleConfirmation() {
    if (Number(chainId) != chain?.id) {
      // check to ensure user is on right network
      setWrongChain(true);
      return;
    } else {
      setWrongChain(false);
    }

    // check to ensure all projects have donation amount
    const emptyDonations = donations.filter(
      (donation) => !donation.amount || Number(donation.amount) === 0
    );

    if (donations.length === 0 || emptyDonations.length > 0) {
      setEmptyInput(true);
      return;
    } else {
      setEmptyInput(false);
    }

    // check if wallet is connected
    if (!address) {
      openConnectModal && openConnectModal();
      return;
    }

    // check if signer has enough token balance
    const accountBalance = selectedPayoutTokenBalance.data?.value;
    const tokenBalance = ethers.utils.parseUnits(
      totalDonation.toString(),
      selectedPayoutToken.decimal
    );

    if (!accountBalance || BigNumber.from(tokenBalance).gt(accountBalance)) {
      setInsufficientBalance(true);
      return;
    } else {
      setInsufficientBalance(false);
    }

    setOpenConfirmationModal(true);
  }

  function PayoutModals() {
    return (
      <>
        <ConfirmationModal
          title={"Confirm Decision"}
          confirmButtonText={"Confirm"}
          confirmButtonAction={() => {
            setOpenInfoModal(true);
            setOpenConfirmationModal(false);
          }}
          body={<ConfirmationModalBody />}
          isOpen={openConfirmationModal}
          setIsOpen={setOpenConfirmationModal}
        />
        <InfoModal
          title={"Heads up!"}
          body={<InfoModalBody />}
          isOpen={openInfoModal}
          setIsOpen={setOpenInfoModal}
          continueButtonAction={handleSubmitDonation}
        />
        <ProgressModal
          isOpen={openProgressModal}
          subheading={"Please hold while we submit your donation."}
          steps={progressSteps}
        />
        <ErrorModal
          isOpen={openErrorModal}
          setIsOpen={setOpenErrorModal}
          tryAgainFn={handleSubmitDonation}
          subheading={errorModalSubHeading}
        />
        {/*Passport not connected warning modal*/}
        <ErrorModal
          isOpen={donateWarningModalOpen}
          setIsOpen={setDonateWarningModalOpen}
          doneFn={() => {
            setDonateWarningModalOpen(false);
            handleConfirmation();
          }}
          tryAgainText={"Go to Passport"}
          doneText={"Donate without matching"}
          tryAgainFn={() => {
            navigate(`/round/${chainId}/${roundId}/passport/connect`);
          }}
          heading={`Don’t miss out on getting your donations matched!`}
          subheading={
            <>
              <p className={"text-sm text-grey-400 mb-2"}>
                Verify with Passport to amplify your donations.
              </p>
              <p className={"text-sm text-grey-400"}>
                Note that donations made without Passport verification will not
                be matched.
              </p>
            </>
          }
          closeOnBackgroundClick={true}
        />
      </>
    );
  }

  function InfoModalBody() {
    return (
      <div className="text-sm text-grey-400 gap-16">
        <p className="text-sm">
          Submitting your donation will require signing two transactions
          <br />
          <strong>if</strong>you are using an ERC20 token:
        </p>
        <ul className="list-disc list-inside pl-3 pt-3">
          <li>Approving the contract to access your wallet</li>
          <li>Approving the transaction</li>
        </ul>
      </div>
    );
  }

  function ConfirmationModalBody() {
    const projectsCount = cart.length;
    return (
      <>
        <p className="text-sm text-grey-400">
          Funding {projectsCount} project{projectsCount > 1 && "s"}
        </p>
        <div className="my-8">
          <ProjectsInCartCount />
        </div>
        <AdditionalGasFeesNote />
      </>
    );
  }

  async function handleSubmitDonation() {
    try {
      if (!round || !roundId) {
        throw new Error("round is null");
      }

      setTimeout(() => {
        setOpenProgressModal(true);
        setOpenInfoModal(false);
      }, modalDelayMs);

      await submitDonations({
        roundId: roundId,
        donations: donations,
        donationToken: selectedPayoutToken,
        totalDonation: totalDonation,
        votingStrategy: round.votingStrategy,
      });
    } catch (error) {
      if (error === Logger.errors.TRANSACTION_REPLACED) {
        setTransactionReplaced(true);
      } else {
        datadogLogs.logger.error(
          `error: handleSubmitDonation - ${error}, id: ${roundId}`
        );
        console.error("handleSubmitDonation - roundId", roundId, error);
      }
    }
  }
}
