// TODO pull in all typings
import LNC from '@lightninglabs/lnc-rn';

import stores from '../stores/Stores';
import CredentialStore from './LNC/credentialStore';
import OpenChannelRequest from './../models/OpenChannelRequest';
import { snakeize } from './../utils/DataFormatUtils';
import VersionUtils from './../utils/VersionUtils';

const ADDRESS_TYPES = [
    'WITNESS_PUBKEY_HASH',
    'NESTED_PUBKEY_HASH',
    'UNUSED_WITNESS_PUBKEY_HASH',
    'UNUSED_NESTED_PUBKEY_HASH',
    'TAPROOT_PUBKEY',
    'UNUSED_TAPROOT_PUBKEY'
];

export default class LightningNodeConnect {
    lnc: any;

    initLNC = () => {
        const { pairingPhrase, mailboxServer, customMailboxServer } =
            stores.settingsStore;

        this.lnc = new LNC({
            credentialStore: new CredentialStore()
        });

        this.lnc.credentials.pairingPhrase = pairingPhrase;
        this.lnc.credentials.serverHost =
            mailboxServer === 'custom-defined'
                ? customMailboxServer
                : mailboxServer;
    };

    connect = async () => await this.lnc.connect();
    isConnected = async () => await this.lnc.isConnected();

    getTransactions = async () =>
        await this.lnc.lnd.lightning.getTransactions({}).then((data: any) => {
            const formatted = snakeize(data);
            return {
                transactions: formatted.transactions.reverse()
            };
        });
    getChannels = async () =>
        await this.lnc.lnd.lightning
            .listChannels({})
            .then((data: any) => snakeize(data));
    getChannelInfo = async (chanId: string) =>
        await this.lnc.lnd.lightning
            .getChanInfo({ chanId })
            .then((data: any) => snakeize(data));
    getBlockchainBalance = async () =>
        await this.lnc.lnd.lightning
            .walletBalance({})
            .then((data: any) => snakeize(data));
    getLightningBalance = async () =>
        await this.lnc.lnd.lightning
            .channelBalance({})
            .then((data: any) => snakeize(data));
    sendCoins = async (data: any) =>
        await this.lnc.lnd.lightning
            .sendCoins({
                addr: data.addr,
                sat_per_byte: data.sat_per_byte,
                amount: data.amount,
                spend_unconfirmed: data.spend_unconfirmed
            })
            .then((data: any) => snakeize(data));
    getMyNodeInfo = async () =>
        await this.lnc.lnd.lightning
            .getInfo({})
            .then((data: any) => snakeize(data));
    getInvoices = async () =>
        await this.lnc.lnd.lightning
            .listInvoices({ reversed: true, num_max_invoices: 100 })
            .then((data: any) => snakeize(data));
    createInvoice = async (data: any) =>
        await this.lnc.lnd.lightning
            .addInvoice(data)
            .then((data: any) => snakeize(data));
    getPayments = async () =>
        await this.lnc.lnd.lightning
            .listPayments({})
            .then((data: any) => snakeize(data));
    getNewAddress = async (data: any) =>
        await this.lnc.lnd.lightning
            .newAddress({ type: ADDRESS_TYPES[data.type] })
            .then((data: any) => snakeize(data));

    openChannel = async (data: OpenChannelRequest) =>
        await this.lnc.lnd.lightning
            .openChannelSync({
                private: data.privateChannel,
                local_funding_amount: data.local_funding_amount,
                min_confs: data.min_confs,
                node_pubkey_string: data.node_pubkey_string,
                sat_per_byte: data.sat_per_byte,
                spend_unconfirmed: data.spend_unconfirmed
            })
            .then((data: any) => snakeize(data));
    // TODO add with external accounts
    // openChannelStream = (data: OpenChannelRequest) =>
    //     this.wsReq('/v1/channels/stream', 'POST', data);
    connectPeer = async (data: any) =>
        await this.lnc.lnd.lightning
            .connectPeer(data)
            .then((data: any) => snakeize(data));
    decodePaymentRequest = async (urlParams?: Array<string>) =>
        await this.lnc.lnd.lightning
            .decodePayReq({ pay_req: urlParams && urlParams[0] })
            .then((data: any) => snakeize(data));
    payLightningInvoice = (data: any) => {
        if (data.pubkey) delete data.pubkey;
        return this.lnc.lnd.router.sendPaymentV2({
            ...data,
            allow_self_payment: true,
            timeout_seconds: 60
        });
    };
    closeChannel = async (urlParams?: Array<string>) => {
        let params;
        if (urlParams && urlParams.length === 4) {
            params = {
                channel_point: {
                    funding_txid_str: urlParams && urlParams[0],
                    output_index:
                        urlParams && urlParams[1] && Number(urlParams[1])
                },
                force: urlParams && urlParams[2],
                sat_per_byte: urlParams && urlParams[3] && Number(urlParams[3])
            };
        }
        params = {
            channel_point: {
                funding_txid_str: urlParams && urlParams[0],
                output_index: urlParams && urlParams[1] && Number(urlParams[1])
            },
            force: urlParams && urlParams[2]
        };
        return await this.lnc.lnd.lightning
            .closeChannel(params)
            .then((data: any) => snakeize(data));
    };
    getNodeInfo = async (urlParams?: Array<string>) =>
        await this.lnc.lnd.lightning
            .getNodeInfo({ pub_key: urlParams && urlParams[0] })
            .then((data: any) => snakeize(data));
    getFees = async () =>
        await this.lnc.lnd.lightning
            .feeReport({})
            .then((data: any) => snakeize(data));
    setFees = async (data: any) => {
        // handle commas in place of decimals
        const base_fee_msat = data.base_fee_msat.replace(/,/g, '.');
        const fee_rate = data.fee_rate.replace(/,/g, '.');

        let params;

        if (data.global) {
            params = {
                base_fee_msat,
                fee_rate: `${Number(fee_rate) / 100}`,
                global: true,
                time_lock_delta: Number(data.time_lock_delta),
                min_htlc_msat: data.min_htlc
                    ? `${Number(data.min_htlc) * 1000}`
                    : null,
                max_htlc_msat: data.max_htlc
                    ? `${Number(data.max_htlc) * 1000}`
                    : null,
                min_htlc_msat_specified: data.min_htlc ? true : false
            };
        }
        params = {
            base_fee_msat,
            fee_rate: `${Number(fee_rate) / 100}`,
            chan_point: {
                funding_txid_str: data.chan_point.funding_txid_str,
                output_index: data.chan_point.output_index
            },
            time_lock_delta: Number(data.time_lock_delta),
            min_htlc_msat: data.min_htlc
                ? `${Number(data.min_htlc) * 1000}`
                : null,
            max_htlc_msat: data.max_htlc
                ? `${Number(data.max_htlc) * 1000}`
                : null,
            min_htlc_msat_specified: data.min_htlc ? true : false
        };
        return await this.lnc.lnd.lightning
            .updateChannelPolicy(params)
            .then((data: any) => snakeize(data));
    };
    getRoutes = async (urlParams?: Array<string>) =>
        await this.lnc.lnd.lightning
            .queryRoutes({
                pub_key: urlParams && urlParams[0],
                amt: urlParams && urlParams[1] && Number(urlParams[1])
            })
            .then((data: any) => snakeize(data));
    getForwardingHistory = async (hours = 24) => {
        const req = {
            num_max_events: 10000000,
            start_time: Math.round(
                new Date(Date.now() - hours * 60 * 60 * 1000).getTime() / 1000
            ).toString(),
            end_time: Math.round(new Date().getTime() / 1000).toString()
        };
        return await this.lnc.lnd.lightning
            .forwardingHistory(req)
            .then((data: any) => snakeize(data));
    };
    // Coin Control
    fundPsbt = async (req: any) =>
        await this.lnc.lnd.walletKit
            .fundPsbt(req)
            .then((data: any) => snakeize(data));
    finalizePsbt = async (req: any) =>
        await this.lnc.lnd.walletKit
            .finalizePsbt(req)
            .then((data: any) => snakeize(data));
    publishTransaction = async (req: any) =>
        await this.lnc.lnd.walletKit
            .publishTransaction(req)
            .then((data: any) => snakeize(data));
    getUTXOs = async () =>
        await this.lnc.lnd.walletKit
            .listUnspent({ min_confs: 0, max_confs: 200000 })
            .then((data: any) => snakeize(data));
    bumpFee = async (req: any) =>
        await this.lnc.lnd.walletKit
            .bumpFee(req)
            .then((data: any) => snakeize(data));
    listAccounts = async () =>
        await this.lnc.lnd.walletKit
            .listAccounts({})
            .then((data: any) => snakeize(data));
    importAccount = async (req: any) =>
        await this.lnc.lnd.walletKit
            .importAccount(req)
            .then((data: any) => snakeize(data));
    signMessage = async (message: string) =>
        await this.lnc.lnd.signer
            .signMessage({ msg: message })
            .then((data: any) => snakeize(data));
    verifyMessage = async (req: any) =>
        await this.lnc.lnd.signer
            .verifyMessage({ msg: req.msg, signature: req.signature })
            .then((data: any) => snakeize(data));
    subscribeInvoice = (r_hash: string) =>
        this.lnc.lnd.invoices.subscribeSingleInvoice({ r_hash });
    subscribeInvoices = () => this.lnc.lnd.lightning.subscribeInvoices();
    subscribeTransactions = () =>
        this.lnc.lnd.lightning.subscribeTransactions();

    supports = (minVersion: string, eosVersion?: string) => {
        const { nodeInfo } = stores.nodeInfoStore;
        const { version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        return isSupportedVersion(version, minVersion, eosVersion);
    };

    supportsMessageSigning = () => true;
    supportsOnchainSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsMPP = () => this.supports('v0.10.0');
    supportsAMP = () => this.supports('v0.13.0');
    supportsHopPicking = () => this.supports('v0.11.0');
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    supportsCoinControl = () => this.supports('v0.12.0');
    supportsAccounts = () => this.supports('v0.13.0');
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsTaproot = () => this.supports('v0.15.0');
    isLNDBased = () => true;
}
